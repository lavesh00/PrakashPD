"""
PrakashPD model training pipeline.

Trains three components and fuses them into one calibrated 0-100 score:
  1. LightGBM binary classifier on structured features (+ NLP-derived features).
  2. Cox Proportional Hazards survival model, giving a horizon-based risk estimate.
  3. Isotonic regression that maps a blend of (1) and (2) onto a calibrated
     probability of default, reported as a 0-100 score.

Evaluation uses the out-of-time (OOT) split produced in
notebooks/01_eda_feature_engineering.ipynb (see that notebook for why the OOT
split is itself a simulated vintage, not a true temporal backtest). Headline
metrics are AUC, Gini, KS, and recall-at-top-20% — not accuracy, because the
target is a ~22% base-rate rare event where a model that predicts "no default"
for everyone scores ~78% accuracy while being useless. See README.md.

Run: python model/train.py
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lifelines import CoxPHFitter
from lightgbm import LGBMClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_auc_score, roc_curve

ROOT = Path(__file__).parent
DATA_DIR = ROOT.parent / "data" / "processed"
ARTIFACT_DIR = ROOT / "artifacts"
ARTIFACT_DIR.mkdir(exist_ok=True)

NUMERIC_FEATURES = [
    "LIMIT_BAL", "AGE",
    "PAY_1", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6",
    "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6",
    "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6",
    "util_ratio_1", "avg_util_ratio", "avg_pay_ratio",
    "months_delinquent", "max_delinquency", "delinquency_trend", "bill_trend",
]
CATEGORICAL_FEATURES = ["SEX", "EDUCATION", "MARRIAGE", "segment"]
N_SVD_COMPONENTS = 8
NLP_FEATURES = [f"nlp_svd_{i}" for i in range(N_SVD_COMPONENTS)]
COX_COVARIATES = [
    "LIMIT_BAL", "AGE", "avg_util_ratio", "avg_pay_ratio",
    "months_delinquent", "max_delinquency", "delinquency_trend", "nlp_svd_0",
]


def load_data():
    train = pd.read_csv(DATA_DIR / "train.csv")
    test = pd.read_csv(DATA_DIR / "test.csv")
    for df in (train, test):
        for c in CATEGORICAL_FEATURES:
            df[c] = df[c].astype("category")
    return train, test


def fit_nlp_pipeline(train_notes: pd.Series):
    tfidf = TfidfVectorizer(max_features=500, stop_words="english", ngram_range=(1, 2))
    svd = TruncatedSVD(n_components=N_SVD_COMPONENTS, random_state=42)
    tfidf_matrix = tfidf.fit_transform(train_notes)
    svd.fit(tfidf_matrix)
    return tfidf, svd


def transform_nlp(tfidf, svd, notes: pd.Series) -> pd.DataFrame:
    matrix = tfidf.transform(notes)
    components = svd.transform(matrix)
    return pd.DataFrame(components, columns=NLP_FEATURES, index=notes.index)


def zscore(df: pd.DataFrame, cols, mean=None, std=None):
    mean = df[cols].mean() if mean is None else mean
    std = df[cols].std().replace(0, 1) if std is None else std
    return (df[cols] - mean) / std, mean, std


def ks_statistic(y_true, y_score) -> float:
    fpr, tpr, _ = roc_curve(y_true, y_score)
    return float(np.max(np.abs(tpr - fpr)))


def recall_at_top_k(y_true, y_score, k_pct=0.2) -> float:
    n = len(y_score)
    k = max(1, int(n * k_pct))
    top_idx = np.argsort(-y_score)[:k]
    total_positives = y_true.sum()
    if total_positives == 0:
        return 0.0
    return float(y_true.iloc[top_idx].sum() / total_positives)


def assign_band(scores_0_100: np.ndarray, high_cut: float, elevated_cut: float) -> np.ndarray:
    bands = np.where(
        scores_0_100 >= high_cut, "High",
        np.where(scores_0_100 >= elevated_cut, "Elevated", "Watch"),
    )
    return bands


def main():
    train, test = load_data()

    # --- NLP feature fusion (fit on train notes only) ---
    tfidf, svd = fit_nlp_pipeline(train["rm_note"])
    train_nlp = transform_nlp(tfidf, svd, train["rm_note"])
    test_nlp = transform_nlp(tfidf, svd, test["rm_note"])
    train = pd.concat([train, train_nlp], axis=1)
    test = pd.concat([test, test_nlp], axis=1)

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES + NLP_FEATURES
    X_train, y_train = train[feature_cols], train["default"]
    X_test, y_test = test[feature_cols], test["default"]

    # --- 1. LightGBM classifier ---
    gbm = LGBMClassifier(
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=31,
        max_depth=-1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_samples=30,
        random_state=42,
        verbosity=-1,
    )
    gbm.fit(X_train, y_train, categorical_feature=CATEGORICAL_FEATURES)
    gbm_train_proba = gbm.predict_proba(X_train)[:, 1]
    gbm_test_proba = gbm.predict_proba(X_test)[:, 1]

    # --- 2. Cox Proportional Hazards survival model ---
    cox_train_z, cox_mean, cox_std = zscore(train, COX_COVARIATES)
    cox_test_z, _, _ = zscore(test, COX_COVARIATES, cox_mean, cox_std)
    cox_train_df = pd.concat(
        [cox_train_z, train[["duration", "event"]].reset_index(drop=True)], axis=1
    )
    cox_train_df = cox_train_df.reset_index(drop=True)

    cph = CoxPHFitter(penalizer=0.1)
    cph.fit(cox_train_df, duration_col="duration", event_col="event")

    horizon = train["duration"].max()  # observed-window horizon (see notebook: proxy for 12mo)
    train_surv = cph.predict_survival_function(cox_train_z, times=[horizon]).T
    test_surv = cph.predict_survival_function(cox_test_z, times=[horizon]).T
    cox_train_risk = (1 - train_surv.iloc[:, 0]).to_numpy()
    cox_test_risk = (1 - test_surv.iloc[:, 0]).to_numpy()

    # --- 3. Blend + isotonic calibration into a single 0-100 score ---
    # Every score (train AND test) is rank-normalized against the fixed *training*
    # distribution via searchsorted. This matches exactly how model/inference.py
    # scores a live loan in production (there is no "test set distribution" to
    # rank against at serving time) — ranking test points against their own
    # distribution instead would peek at test-set shape and is not something a
    # deployed model could ever do.
    gbm_train_sorted = np.sort(gbm_train_proba)
    cox_train_sorted = np.sort(cox_train_risk)

    def rank_against_reference(values, reference_sorted):
        ranks = np.searchsorted(reference_sorted, values)
        return np.clip(ranks, 0, len(reference_sorted) - 1) / (len(reference_sorted) - 1)

    gbm_train_rank = rank_against_reference(gbm_train_proba, gbm_train_sorted)
    cox_train_rank = rank_against_reference(cox_train_risk, cox_train_sorted)
    blend_train = 0.7 * gbm_train_rank + 0.3 * cox_train_rank

    gbm_test_rank = rank_against_reference(gbm_test_proba, gbm_train_sorted)
    cox_test_rank = rank_against_reference(cox_test_risk, cox_train_sorted)
    blend_test = 0.7 * gbm_test_rank + 0.3 * cox_test_rank

    isotonic = IsotonicRegression(out_of_bounds="clip")
    isotonic.fit(blend_train, y_train)
    calibrated_train = isotonic.predict(blend_train)
    calibrated_test = isotonic.predict(blend_test)

    score_train = calibrated_train * 100
    score_test = calibrated_test * 100

    # --- Metrics on the OOT holdout ---
    auc = roc_auc_score(y_test, score_test)
    gini = 2 * auc - 1
    ks = ks_statistic(y_test, score_test)
    recall20 = recall_at_top_k(y_test, score_test, 0.2)

    high_cut = float(np.percentile(score_train, 90))
    elevated_cut = float(np.percentile(score_train, 70))
    bands_test = assign_band(score_test, high_cut, elevated_cut)

    metrics = {
        "auc": auc,
        "gini": gini,
        "ks_statistic": ks,
        "recall_at_top_20pct": recall20,
        "n_train": len(train),
        "n_test": len(test),
        "test_default_rate": float(y_test.mean()),
        "band_thresholds": {"high": high_cut, "elevated": elevated_cut},
        "band_distribution_test": pd.Series(bands_test).value_counts(normalize=True).to_dict(),
        "note": (
            "AUC/Gini/KS/recall@20% reported instead of accuracy because the "
            "target is a ~22% base-rate rare event; a trivial all-negative "
            "classifier scores ~78% accuracy while capturing zero defaulters. "
            "OOT split uses a simulated loan-vintage field (see notebook) since "
            "the source dataset has no real date field."
        ),
    }

    print(json.dumps(metrics, indent=2))

    # --- Save artifacts ---
    gbm.booster_.save_model(str(ARTIFACT_DIR / "gbm_model.txt"))
    joblib.dump(cph, ARTIFACT_DIR / "cox_model.joblib")
    joblib.dump(tfidf, ARTIFACT_DIR / "tfidf.joblib")
    joblib.dump(svd, ARTIFACT_DIR / "svd.joblib")
    joblib.dump(isotonic, ARTIFACT_DIR / "isotonic.joblib")
    joblib.dump({"mean": cox_mean, "std": cox_std}, ARTIFACT_DIR / "cox_scaler.joblib")

    # reference distributions so a single new score (live scoring / what-if) can
    # be rank-normalized against the same population used at training time
    np.save(ARTIFACT_DIR / "gbm_train_proba_ref.npy", np.sort(gbm_train_proba))
    np.save(ARTIFACT_DIR / "cox_train_risk_ref.npy", np.sort(cox_train_risk))

    config = {
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "nlp_features": NLP_FEATURES,
        "cox_covariates": COX_COVARIATES,
        "gbm_blend_weight": 0.7,
        "cox_blend_weight": 0.3,
        "cox_horizon_duration": float(horizon),
        "band_thresholds": {"high": high_cut, "elevated": elevated_cut},
    }
    with open(ARTIFACT_DIR / "config.json", "w") as f:
        json.dump(config, f, indent=2)

    with open(ARTIFACT_DIR / "metrics_report.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # scored full book (train+test) for the backend to serve as the "loan book"
    train_out = train[[
        "segment", "exposure_at_risk", "rm_note", "default", "loan_vintage_month",
    ]].copy()
    train_out["borrower_id"] = train_out.index
    train_out["pd_score"] = score_train
    train_out["split"] = "train"

    test_out = test[[
        "segment", "exposure_at_risk", "rm_note", "default", "loan_vintage_month",
    ]].copy()
    test_out["borrower_id"] = test_out.index + len(train)
    test_out["pd_score"] = score_test
    test_out["split"] = "test"

    scored = pd.concat([train_out, test_out], ignore_index=True)
    scored["band"] = assign_band(scored["pd_score"].to_numpy(), high_cut, elevated_cut)
    scored.to_csv(ARTIFACT_DIR / "scored_book.csv", index=False)

    # also persist the raw feature rows keyed by borrower_id so the backend can
    # recompute SHAP reason codes for any single loan on demand
    full_features = pd.concat([train, test], ignore_index=True)
    full_features["borrower_id"] = pd.concat([train_out["borrower_id"], test_out["borrower_id"]], ignore_index=True)
    full_features[feature_cols + ["borrower_id", "rm_note"]].to_csv(
        ARTIFACT_DIR / "feature_book.csv", index=False
    )

    print(f"\nArtifacts written to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
