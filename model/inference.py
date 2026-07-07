"""
Generic inference module.

Everything downstream (the FastAPI backend's watchlist scoring, live "score a
new loan" endpoint, and the what-if simulator) goes through `score_feature_row`
in this file. It is deliberately NOT keyed by borrower_id — it accepts an
arbitrary feature dict, engineers the same derived features used at training
time, and re-runs the full GBM + Cox + isotonic pipeline. This is what makes
the what-if simulator a real recomputation rather than a lookup or a linear
approximation.

Honesty note (see README for the full version): the trained model's strongest
signals are repayment-history features (PAY_1..PAY_6, bill trend, utilization)
that a genuinely first-time loan applicant would not yet have. "Score a new
loan" is best understood as scoring an application where the officer supplies
either an initial track record or a neutral/no-history default — the same
real/behavior-vs-application-scorecard distinction that exists in production
bank risk stacks. Fields that are not trained features (e.g. annual income)
are accepted for the memo/display only and never enter the feature vector.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).parent
ARTIFACT_DIR = ROOT / "artifacts"

_PAY_STATUS_COLS = [f"PAY_{i}" for i in range(1, 7)]
_BILL_COLS = [f"BILL_AMT{i}" for i in range(1, 7)]
_PAY_AMT_COLS = [f"PAY_AMT{i}" for i in range(1, 7)]


class ScoringEngine:
    """Loads all trained artifacts once and exposes scoring/what-if/explain methods."""

    def __init__(self):
        with open(ARTIFACT_DIR / "config.json") as f:
            self.config = json.load(f)
        self.numeric_features = self.config["numeric_features"]
        self.categorical_features = self.config["categorical_features"]
        self.nlp_features = self.config["nlp_features"]
        self.feature_cols = self.numeric_features + self.categorical_features + self.nlp_features
        self.cox_covariates = self.config["cox_covariates"]
        self.gbm_weight = self.config["gbm_blend_weight"]
        self.cox_weight = self.config["cox_blend_weight"]
        self.horizon = self.config["cox_horizon_duration"]
        self.high_cut = self.config["band_thresholds"]["high"]
        self.elevated_cut = self.config["band_thresholds"]["elevated"]

        self.booster = lgb.Booster(model_file=str(ARTIFACT_DIR / "gbm_model.txt"))
        self.tree_explainer = shap.TreeExplainer(self.booster)
        self.cph = joblib.load(ARTIFACT_DIR / "cox_model.joblib")
        self.tfidf = joblib.load(ARTIFACT_DIR / "tfidf.joblib")
        self.svd = joblib.load(ARTIFACT_DIR / "svd.joblib")
        self.isotonic = joblib.load(ARTIFACT_DIR / "isotonic.joblib")
        scaler = joblib.load(ARTIFACT_DIR / "cox_scaler.joblib")
        self.cox_mean, self.cox_std = scaler["mean"], scaler["std"]

        self.gbm_train_ref = np.load(ARTIFACT_DIR / "gbm_train_proba_ref.npy")
        self.cox_train_ref = np.load(ARTIFACT_DIR / "cox_train_risk_ref.npy")

        self.feature_book = pd.read_csv(ARTIFACT_DIR / "feature_book.csv")
        for c in self.categorical_features:
            self.feature_book[c] = self.feature_book[c].astype("category")
        self.feature_book = self.feature_book.set_index("borrower_id", drop=False)
        self._category_dtypes = self.feature_book[self.categorical_features].dtypes
        self._mode_categories = {
            c: self.feature_book[c].mode(dropna=True).iloc[0] for c in self.categorical_features
        }

    # ---------- feature engineering (mirrors notebooks/01_eda_feature_engineering.ipynb) ----------

    @staticmethod
    def engineer_features(raw: dict) -> dict:
        """raw must contain LIMIT_BAL, AGE, PAY_1..6, BILL_AMT1..6, PAY_AMT1..6
        (and optionally SEX/EDUCATION/MARRIAGE/segment). Returns raw plus the
        engineered numeric features, using the exact formulas used at training
        time so a live score is computed the same way the historical book was.
        """
        out = dict(raw)
        limit_bal = out["LIMIT_BAL"] if out["LIMIT_BAL"] else np.nan
        bills = np.array([out[c] for c in _BILL_COLS], dtype=float)
        pay_amts = np.array([out[c] for c in _PAY_AMT_COLS], dtype=float)
        pays = np.array([out[c] for c in _PAY_STATUS_COLS], dtype=float)

        util_ratio_1 = np.clip(bills[0] / limit_bal, -2, 5) if limit_bal else 0.0
        avg_util_ratio = np.clip(bills.mean() / limit_bal, -2, 5) if limit_bal else 0.0
        with np.errstate(divide="ignore", invalid="ignore"):
            ratios = pay_amts / np.where(bills == 0, np.nan, bills)
        avg_pay_ratio = np.nanmean(ratios) if not np.all(np.isnan(ratios)) else 0.0
        avg_pay_ratio = float(np.clip(np.nan_to_num(avg_pay_ratio, nan=0.0), -5, 5))

        out["util_ratio_1"] = float(np.nan_to_num(util_ratio_1))
        out["avg_util_ratio"] = float(np.nan_to_num(avg_util_ratio))
        out["avg_pay_ratio"] = avg_pay_ratio
        out["months_delinquent"] = int((pays > 0).sum())
        out["max_delinquency"] = float(pays.max())
        out["delinquency_trend"] = float(pays[0] - pays[5])
        out["bill_trend"] = float(bills[0] - bills[5])
        return out

    def _fill_defaults(self, raw: dict) -> dict:
        filled = dict(raw)
        for c in self.categorical_features:
            filled.setdefault(c, self._mode_categories[c])
        return filled

    # ---------- core scoring ----------

    def _row_to_frame(self, engineered: dict) -> pd.DataFrame:
        X = pd.DataFrame([{k: engineered[k] for k in self.numeric_features + self.categorical_features}])
        X[self.numeric_features] = X[self.numeric_features].astype(float)
        for c in self.categorical_features:
            X[c] = X[c].astype(self._category_dtypes[c])
        return X

    def _nlp_features(self, rm_note: str) -> pd.DataFrame:
        matrix = self.tfidf.transform([rm_note or ""])
        components = self.svd.transform(matrix)
        return pd.DataFrame(components, columns=self.nlp_features)

    def _rank_against_reference(self, value: float, reference_sorted: np.ndarray) -> float:
        idx = np.searchsorted(reference_sorted, value)
        return float(np.clip(idx, 0, len(reference_sorted) - 1) / (len(reference_sorted) - 1))

    def score_feature_row(self, raw: dict, rm_note: str = "") -> dict:
        """raw: dict with LIMIT_BAL, AGE, PAY_1..6, BILL_AMT1..6, PAY_AMT1..6,
        and optionally SEX/EDUCATION/MARRIAGE/segment (defaulted to training
        mode if absent). Returns pd_score (0-100), band, and the full engineered
        feature row (useful for explanation)."""
        raw = self._fill_defaults(raw)
        engineered = self.engineer_features(raw)
        X = self._row_to_frame(engineered)
        nlp_df = self._nlp_features(rm_note)
        X_full = pd.concat([X.reset_index(drop=True), nlp_df.reset_index(drop=True)], axis=1)
        X_full = X_full[self.feature_cols]

        gbm_proba = float(self.booster.predict(X_full)[0])

        cox_row = {**engineered, **{f: v for f, v in zip(self.nlp_features, nlp_df.iloc[0].tolist())}}
        cox_z = pd.DataFrame(
            [{c: (cox_row[c] - self.cox_mean[c]) / self.cox_std[c] for c in self.cox_covariates}]
        )
        surv = self.cph.predict_survival_function(cox_z, times=[self.horizon]).T
        cox_risk = float(1 - surv.iloc[0, 0])

        gbm_rank = self._rank_against_reference(gbm_proba, self.gbm_train_ref)
        cox_rank = self._rank_against_reference(cox_risk, self.cox_train_ref)
        blend = self.gbm_weight * gbm_rank + self.cox_weight * cox_rank
        calibrated = float(self.isotonic.predict([blend])[0])
        pd_score = calibrated * 100
        band = self._band(pd_score)

        return {
            "pd_score": pd_score,
            "band": band,
            "gbm_proba": gbm_proba,
            "cox_risk": cox_risk,
            "feature_row": engineered,
            "X_full": X_full,
            "rm_note": rm_note,
        }

    def _band(self, pd_score: float) -> str:
        if pd_score >= self.high_cut:
            return "High"
        if pd_score >= self.elevated_cut:
            return "Elevated"
        return "Watch"

    def reason_codes(self, X_full: pd.DataFrame, context: dict, top_k: int = 4) -> list[str]:
        from model.explain import _reason_for_feature  # local import avoids a cycle at module load

        shap_values = self.tree_explainer.shap_values(X_full)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        shap_row = np.asarray(shap_values).reshape(-1)
        order = np.argsort(-np.abs(shap_row))[:top_k]
        reasons = []
        for idx in order:
            feature = self.feature_cols[idx]
            value = X_full.iloc[0][feature]
            reasons.append(_reason_for_feature(feature, value, shap_row[idx], context))
        return reasons

    # ---------- existing-loan lookup ----------

    def get_loan_raw(self, borrower_id: int) -> dict:
        if borrower_id not in self.feature_book.index:
            raise KeyError(f"borrower_id {borrower_id} not found")
        row = self.feature_book.loc[borrower_id]
        raw = {c: row[c] for c in _PAY_STATUS_COLS + _BILL_COLS + _PAY_AMT_COLS + ["LIMIT_BAL", "AGE"]}
        for c in self.categorical_features:
            raw[c] = row[c]
        return raw, row.get("rm_note", "")

    def score_existing_loan(self, borrower_id: int) -> dict:
        raw, rm_note = self.get_loan_raw(borrower_id)
        return self.score_feature_row(raw, rm_note)

    def score_full_book(self) -> pd.DataFrame:
        """Vectorized re-score of the entire stored feature book. This is what
        the /batch-rescore endpoint calls to simulate the "overnight scoring"
        story: it genuinely re-runs the trained GBM + Cox + isotonic pipeline
        over every row (not a cached lookup), just done in batch rather than
        row-by-row for speed."""
        X_full = self.feature_book[self.feature_cols].copy()
        gbm_proba = self.booster.predict(X_full)

        cox_z = (self.feature_book[self.cox_covariates] - self.cox_mean) / self.cox_std
        surv = self.cph.predict_survival_function(cox_z, times=[self.horizon]).T
        cox_risk = (1 - surv.iloc[:, 0]).to_numpy()

        gbm_rank = np.searchsorted(self.gbm_train_ref, gbm_proba) / (len(self.gbm_train_ref) - 1)
        cox_rank = np.searchsorted(self.cox_train_ref, cox_risk) / (len(self.cox_train_ref) - 1)
        gbm_rank = np.clip(gbm_rank, 0, 1)
        cox_rank = np.clip(cox_rank, 0, 1)
        blend = self.gbm_weight * gbm_rank + self.cox_weight * cox_rank
        calibrated = self.isotonic.predict(blend)
        pd_score = calibrated * 100
        bands = np.where(
            pd_score >= self.high_cut, "High",
            np.where(pd_score >= self.elevated_cut, "Elevated", "Watch"),
        )
        result = pd.DataFrame({
            "borrower_id": self.feature_book["borrower_id"].to_numpy(),
            "pd_score": pd_score,
            "band": bands,
        })
        return result

    # ---------- what-if: EMI-formula translation layer ----------

    @staticmethod
    def compute_emi(principal: float, annual_rate_pct: float, tenure_months: int) -> float:
        """Standard reducing-balance EMI formula. This is real, deterministic
        finance math (not a model approximation) used only to translate
        human-friendly loan terms (rate, tenure) into a payment amount that the
        trained model's avg_pay_ratio feature can consume. See README."""
        r = (annual_rate_pct / 100) / 12
        n = tenure_months
        if r == 0:
            return principal / n
        return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)

    def what_if(
        self,
        borrower_id: int,
        new_rate_pct: Optional[float] = None,
        new_tenure_months: Optional[int] = None,
        new_principal: Optional[float] = None,
        new_emi: Optional[float] = None,
    ) -> dict:
        original = self.score_existing_loan(borrower_id)
        raw, rm_note = self.get_loan_raw(borrower_id)
        modified = dict(raw)

        # A restructure is a going-forward change, not a one-month blip: a new
        # principal or a new EMI schedule is applied across the whole 6-cycle
        # window so it actually moves the averaged features (avg_util_ratio,
        # avg_pay_ratio) the model relies on, instead of being diluted 1-in-6.
        principal = new_principal if new_principal is not None else raw["BILL_AMT1"]
        if new_principal is not None:
            for c in _BILL_COLS:
                modified[c] = new_principal

        emi = new_emi
        if emi is None and (new_rate_pct is not None or new_tenure_months is not None):
            rate = new_rate_pct if new_rate_pct is not None else 12.0
            tenure = new_tenure_months if new_tenure_months is not None else 12
            emi = self.compute_emi(principal, rate, tenure)
        if emi is not None:
            for c in _PAY_AMT_COLS:
                modified[c] = emi

        new_result = self.score_feature_row(modified, rm_note)
        return {
            "borrower_id": borrower_id,
            "original_pd_score": original["pd_score"],
            "original_band": original["band"],
            "new_pd_score": new_result["pd_score"],
            "new_band": new_result["band"],
            "delta": new_result["pd_score"] - original["pd_score"],
            "applied_emi": emi,
            "applied_principal": principal if new_principal is not None else None,
        }


_engine: Optional[ScoringEngine] = None


def get_engine() -> ScoringEngine:
    global _engine
    if _engine is None:
        _engine = ScoringEngine()
    return _engine
