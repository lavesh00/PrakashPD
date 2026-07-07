"""
SHAP-based reason-code generator.

Loads the trained LightGBM booster and, for a given borrower_id, computes SHAP
values for that single row and translates the top 3-4 contributing features
into plain-language reason strings a credit officer can read without knowing
what a SHAP value or a raw feature name is.

For the NLP-fusion features (nlp_svd_*), rather than describing an abstract
embedding component, the reason code quotes the borrower's actual RM note —
this is more honest and more useful to a credit officer than "component 3
contributed 0.04".
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).parent
ARTIFACT_DIR = ROOT / "artifacts"

_TOP_K = 4

SEGMENT_LABELS = {
    "SME": "an SME lending",
    "Agri": "an agricultural lending",
    "Retail Personal": "a retail personal loan",
    "Credit Card": "a credit card",
    "Consumer Durable": "a consumer durable loan",
}


def _fmt_currency(v: float) -> str:
    return f"Rs {v:,.0f}"


def _pay_cycle_label(col: str) -> str:
    n = int(col[-1])
    return "the most recent billing cycle" if n == 1 else f"{n} billing cycles ago"


_PAY_STATUS_COLS = {f"PAY_{i}" for i in range(1, 7)}


def _reason_for_feature(feature: str, value, shap_value: float, row: pd.Series) -> str:
    increases_risk = shap_value > 0

    if feature in _PAY_STATUS_COLS:
        if value > 0:
            return f"Repayment status in {_pay_cycle_label(feature)} shows a {int(value)}-month delay"
        return f"Repayment status in {_pay_cycle_label(feature)} was on time"

    if feature == "months_delinquent":
        return f"{int(value)} of the last 6 billing cycles were delinquent"

    if feature == "max_delinquency":
        if value <= 0:
            return "No delinquency recorded in the observed window"
        return f"Worst delinquency reached {int(value)} month(s) overdue"

    if feature == "delinquency_trend":
        if value > 0:
            return f"Repayment status has worsened by {int(value)} point(s) over the last 6 cycles"
        return f"Repayment status has improved by {int(-value)} point(s) over the last 6 cycles"

    if feature == "avg_util_ratio":
        direction = "elevated" if increases_risk else "moderate"
        return f"Average credit utilization is {direction} at {value:.0%} of limit"

    if feature == "util_ratio_1":
        return f"Most recent billing cycle utilization at {value:.0%} of limit"

    if feature == "avg_pay_ratio":
        if increases_risk:
            return f"Payments covering only {value:.0%} of the billed amount on average"
        return f"Payments consistently covering {value:.0%} of the billed amount"

    if feature == "bill_trend":
        if value > 0:
            return f"Outstanding bill has grown by {_fmt_currency(value)} over the observed window"
        return f"Outstanding bill has declined by {_fmt_currency(-value)} over the observed window"

    if feature == "LIMIT_BAL":
        return f"Sanctioned credit limit of {_fmt_currency(value)}"

    if feature == "AGE":
        return f"Borrower age {int(value)}"

    if feature == "segment":
        label = SEGMENT_LABELS.get(str(value), str(value))
        return f"Exposure is on {label} product line, which carries a different baseline risk"

    if feature in ("SEX", "EDUCATION", "MARRIAGE"):
        return f"Demographic profile factor ({feature.lower()} category {value})"

    if feature.startswith("nlp_svd_"):
        note = row.get("rm_note", "")
        if increases_risk:
            return f'RM note content pushed the score higher: "{note}"'
        return f'RM note content pushed the score lower: "{note}"'

    if feature.startswith("BILL_AMT"):
        return f"Outstanding bill in {_pay_cycle_label('PAY_' + feature[-1])} was {_fmt_currency(value)}"

    if feature.startswith("PAY_AMT"):
        return f"Payment made in {_pay_cycle_label('PAY_' + feature[-1])} was {_fmt_currency(value)}"

    return f"{feature.replace('_', ' ')} = {value}"


class ReasonCodeExplainer:
    def __init__(self):
        with open(ARTIFACT_DIR / "config.json") as f:
            self.config = json.load(f)
        self.feature_cols = (
            self.config["numeric_features"]
            + self.config["categorical_features"]
            + self.config["nlp_features"]
        )
        booster = lgb.Booster(model_file=str(ARTIFACT_DIR / "gbm_model.txt"))
        self.booster = booster
        self.explainer = shap.TreeExplainer(booster)
        self.feature_book = pd.read_csv(ARTIFACT_DIR / "feature_book.csv")
        for c in self.config["categorical_features"]:
            self.feature_book[c] = self.feature_book[c].astype("category")
        self.feature_book = self.feature_book.set_index("borrower_id", drop=False)

    def reason_codes(self, borrower_id: int, top_k: int = _TOP_K) -> list[str]:
        row = self.feature_book.loc[borrower_id]
        X = pd.DataFrame([row[self.feature_cols].to_dict()])
        numeric_cols = self.config["numeric_features"] + self.config["nlp_features"]
        X[numeric_cols] = X[numeric_cols].astype(float)
        for c, dtype in self.feature_book[self.config["categorical_features"]].dtypes.items():
            X[c] = X[c].astype(dtype)
        shap_values = self.explainer.shap_values(X)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        shap_row = np.asarray(shap_values).reshape(-1)

        order = np.argsort(-np.abs(shap_row))[:top_k]
        reasons = []
        for idx in order:
            feature = self.feature_cols[idx]
            value = X.iloc[0][feature]
            reasons.append(_reason_for_feature(feature, value, shap_row[idx], row))
        return reasons


RECOMMENDED_ACTIONS = {
    "High": "Escalate to credit committee for review; place on close watch; consider limit freeze pending RM follow-up.",
    "Elevated": "RM to conduct a check-in call within 2 weeks; monitor closely through the next billing cycle.",
    "Watch": "Include in standard quarterly monitoring; no immediate action required.",
}


def recommended_action(band: str) -> str:
    return RECOMMENDED_ACTIONS.get(band, RECOMMENDED_ACTIONS["Watch"])


if __name__ == "__main__":
    explainer = ReasonCodeExplainer()
    scored = pd.read_csv(ARTIFACT_DIR / "scored_book.csv")
    sample = scored.sort_values("pd_score", ascending=False).head(3)
    for _, r in sample.iterrows():
        print(f"\nborrower_id={r['borrower_id']} pd_score={r['pd_score']:.1f} band={r['band']}")
        for reason in explainer.reason_codes(int(r["borrower_id"])):
            print(" -", reason)
        print(" action:", recommended_action(r["band"]))
