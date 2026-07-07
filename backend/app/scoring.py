"""
Scoring service: thin orchestration layer over model.inference.ScoringEngine.
All the actual model math (GBM + Cox PH + isotonic calibration, SHAP reason
codes, the EMI-formula what-if translation) lives in model/inference.py so
there is exactly one implementation shared by batch scoring, live scoring,
and the what-if simulator. This module just adds the book-level bookkeeping
(segment / exposure_at_risk / watchlist filtering) that only the backend needs.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from model.explain import recommended_action  # noqa: E402
from model.inference import get_engine  # noqa: E402

ARTIFACT_DIR = ROOT / "model" / "artifacts"


class ScoringService:
    def __init__(self):
        self.engine = get_engine()
        scored_book = pd.read_csv(ARTIFACT_DIR / "scored_book.csv")
        meta_cols = ["borrower_id", "segment", "exposure_at_risk", "default", "split"]
        self.meta = scored_book[meta_cols].set_index("borrower_id", drop=False)
        self.last_scored_at: float = 0.0
        self.rescore()

    def rescore(self) -> dict:
        result = self.engine.score_full_book()
        result = result.set_index("borrower_id", drop=False)
        self.book = self.meta.join(result[["pd_score", "band"]])
        self.last_scored_at = time.time()
        return {"scored_at": self.last_scored_at, "n_scored": int(len(self.book))}

    def watchlist(self, segment: str | None, band: str | None, limit: int, offset: int):
        df = self.book
        if segment:
            df = df[df["segment"] == segment]
        if band:
            df = df[df["band"] == band]
        df = df.sort_values("exposure_at_risk", ascending=False)
        total = len(df)
        page = df.iloc[offset: offset + limit]
        items = [
            {
                "borrower_id": int(r.borrower_id),
                "segment": r.segment,
                "pd_score": round(float(r.pd_score), 1),
                "band": r.band,
                "exposure_at_risk": round(float(r.exposure_at_risk), 2),
            }
            for r in page.itertuples()
        ]
        return items, total

    def summary(self):
        band_counts = self.book["band"].value_counts().to_dict()
        return {
            "total_exposure": round(float(self.book["exposure_at_risk"].sum()), 2),
            "total_borrowers": int(len(self.book)),
            "band_counts": {k: int(v) for k, v in band_counts.items()},
            "segments": sorted(self.book["segment"].unique().tolist()),
            "last_scored_at": self.last_scored_at,
            "band_thresholds": {
                "high": self.engine.high_cut,
                "elevated": self.engine.elevated_cut,
            },
        }

    def loan_detail(self, borrower_id: int):
        if borrower_id not in self.book.index:
            return None
        row = self.book.loc[borrower_id]
        result = self.engine.score_existing_loan(borrower_id)
        reasons = self.engine.reason_codes(result["X_full"], result["feature_row"])
        return {
            "borrower_id": int(row.borrower_id),
            "segment": row.segment,
            "pd_score": round(float(result["pd_score"]), 1),
            "band": result["band"],
            "exposure_at_risk": round(float(row.exposure_at_risk), 2),
            "rm_note": result["rm_note"],
            "reason_codes": reasons,
            "recommended_action": recommended_action(result["band"]),
        }

    def score_new_loan(self, req) -> dict:
        from .schemas import REPAYMENT_HISTORY_CODES

        pay_code = REPAYMENT_HISTORY_CODES[req.repayment_history]
        bill1 = req.credit_utilization_pct / 100 * req.loan_amount
        raw = {
            "LIMIT_BAL": req.loan_amount,
            "AGE": req.age,
            **{f"PAY_{i}": pay_code for i in range(1, 7)},
            **{f"BILL_AMT{i}": bill1 for i in range(1, 7)},
            **{f"PAY_AMT{i}": req.existing_emi for i in range(1, 7)},
        }
        if req.segment:
            raw["segment"] = req.segment
        result = self.engine.score_feature_row(raw, req.rm_note)
        reasons = self.engine.reason_codes(result["X_full"], result["feature_row"])
        return {
            "pd_score": round(float(result["pd_score"]), 1),
            "band": result["band"],
            "reason_codes": reasons,
            "recommended_action": recommended_action(result["band"]),
        }

    def what_if(self, borrower_id: int, req) -> dict:
        if borrower_id not in self.book.index:
            return None
        result = self.engine.what_if(
            borrower_id,
            new_rate_pct=req.new_rate_pct,
            new_tenure_months=req.new_tenure_months,
            new_principal=req.new_principal,
            new_emi=req.new_emi,
        )
        result["original_pd_score"] = round(result["original_pd_score"], 1)
        result["new_pd_score"] = round(result["new_pd_score"], 1)
        result["delta"] = round(result["delta"], 1)
        return result

    def model_performance(self) -> dict:
        with open(ARTIFACT_DIR / "metrics_report.json") as f:
            metrics = json.load(f)
        importance = self.engine.feature_importance(top_n=15)
        return {
            "auc": metrics["auc"],
            "gini": metrics["gini"],
            "ks_statistic": metrics["ks_statistic"],
            "recall_at_top_20pct": metrics["recall_at_top_20pct"],
            "n_train": metrics["n_train"],
            "n_test": metrics["n_test"],
            "test_default_rate": metrics["test_default_rate"],
            "band_thresholds": metrics["band_thresholds"],
            "band_distribution_test": metrics["band_distribution_test"],
            "feature_importance": importance,
            "note": metrics["note"],
        }

    def portfolio_stress_test(self, scenario: str, magnitude: float) -> dict:
        stressed = self.engine.stress_test(scenario, magnitude).set_index("borrower_id", drop=False)
        merged = self.book[["band", "exposure_at_risk"]].join(
            stressed[["band"]], rsuffix="_after"
        )
        merged = merged.rename(columns={"band": "band_before", "band_after": "band_after"})

        def _by_band(col: str) -> dict:
            return {b: int(v) for b, v in merged[col].value_counts().to_dict().items()}

        def _exposure_by_band(col: str) -> dict:
            grouped = merged.groupby(col)["exposure_at_risk"].sum()
            return {b: round(float(v), 2) for b, v in grouped.to_dict().items()}

        newly_high = merged[(merged["band_before"] != "High") & (merged["band_after"] == "High")]

        return {
            "scenario": scenario,
            "magnitude": magnitude,
            "band_counts_before": _by_band("band_before"),
            "band_counts_after": _by_band("band_after"),
            "exposure_before": _exposure_by_band("band_before"),
            "exposure_after": _exposure_by_band("band_after"),
            "newly_high_count": int(len(newly_high)),
            "newly_high_exposure": round(float(newly_high["exposure_at_risk"].sum()), 2),
            "total_exposure": round(float(merged["exposure_at_risk"].sum()), 2),
        }

    def settings(self) -> dict:
        config = self.engine.config
        return {
            "band_thresholds": config["band_thresholds"],
            "gbm_blend_weight": config["gbm_blend_weight"],
            "cox_blend_weight": config["cox_blend_weight"],
            "cox_horizon_duration": config["cox_horizon_duration"],
            "embedding_model": config["embedding_model"],
            "segments": sorted(self.book["segment"].unique().tolist()),
            "total_borrowers": int(len(self.book)),
            "last_scored_at": self.last_scored_at,
        }
