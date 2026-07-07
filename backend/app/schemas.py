from typing import Literal, Optional

from pydantic import BaseModel, Field


class ReasonCode(BaseModel):
    text: str
    is_nlp: bool = False


class WatchlistItem(BaseModel):
    borrower_id: int
    segment: str
    pd_score: float
    band: str
    exposure_at_risk: float


class WatchlistResponse(BaseModel):
    items: list[WatchlistItem]
    total: int
    limit: int
    offset: int


class LoanDetail(BaseModel):
    borrower_id: int
    segment: str
    pd_score: float
    band: str
    exposure_at_risk: float
    rm_note: str
    reason_codes: list[ReasonCode]
    recommended_action: str


class SummaryResponse(BaseModel):
    total_exposure: float
    total_borrowers: int
    band_counts: dict[str, int]
    segments: list[str]
    last_scored_at: float
    band_thresholds: dict[str, float]


class RescoreResponse(BaseModel):
    scored_at: float
    n_scored: int


# ---------- live "score a new loan" ----------

REPAYMENT_HISTORY_CODES = {
    "clean": -1.0,
    "minor_delay": 1.0,
    "moderate_delay": 2.0,
    "severe_delinquency": 4.0,
}


class NewLoanRequest(BaseModel):
    """Fields that map to real trained features (loan_amount, age,
    repayment_history, credit_utilization_pct, existing_emi, segment, rm_note)
    genuinely drive the score. `tenure_months` and `annual_income` are
    accepted for context/memo display only and are NOT fed into the model —
    see README for why (this model has no trained feature for either)."""

    loan_amount: float = Field(..., gt=0, description="Proposed credit limit / loan amount")
    age: int = Field(35, ge=18, le=100)
    tenure_months: int = Field(12, ge=1, le=360, description="Context only — not a trained feature")
    annual_income: Optional[float] = Field(None, description="Context only — not a trained feature")
    existing_emi: float = Field(..., ge=0, description="Typical/expected monthly payment")
    credit_utilization_pct: float = Field(..., ge=0, le=300, description="Outstanding balance as % of limit")
    repayment_history: Literal["clean", "minor_delay", "moderate_delay", "severe_delinquency"] = "clean"
    segment: Optional[str] = None
    rm_note: str = ""


class ScoreResponse(BaseModel):
    pd_score: float
    band: str
    reason_codes: list[ReasonCode]
    recommended_action: str


# ---------- what-if simulator ----------


class WhatIfRequest(BaseModel):
    new_rate_pct: Optional[float] = Field(None, ge=0, le=60)
    new_tenure_months: Optional[int] = Field(None, ge=1, le=360)
    new_principal: Optional[float] = Field(None, gt=0)
    new_emi: Optional[float] = Field(None, ge=0)


class WhatIfResponse(BaseModel):
    borrower_id: int
    original_pd_score: float
    original_band: str
    new_pd_score: float
    new_band: str
    delta: float
    applied_emi: Optional[float]
    applied_principal: Optional[float]


# ---------- memo ----------


class MemoResponse(BaseModel):
    borrower_id: int
    segment: str
    exposure_at_risk: float
    pd_score: float
    band: str
    reason_codes: list[ReasonCode]
    recommended_intervention: str
    summary: str
    generated_at: str
    pdf_url: str


# ---------- model performance ----------


class FeatureImportanceEntry(BaseModel):
    feature: str
    importance_pct: float
    is_nlp: bool


class ModelPerformanceResponse(BaseModel):
    auc: float
    gini: float
    ks_statistic: float
    recall_at_top_20pct: float
    n_train: int
    n_test: int
    test_default_rate: float
    band_thresholds: dict[str, float]
    band_distribution_test: dict[str, float]
    feature_importance: list[FeatureImportanceEntry]
    note: str


# ---------- portfolio stress test ----------


class StressTestRequest(BaseModel):
    scenario: Literal["utilization_shock", "delinquency_shock"]
    magnitude: float = Field(..., description="Percent for utilization_shock, notches for delinquency_shock")


class StressTestResponse(BaseModel):
    scenario: str
    magnitude: float
    band_counts_before: dict[str, int]
    band_counts_after: dict[str, int]
    exposure_before: dict[str, float]
    exposure_after: dict[str, float]
    newly_high_count: int
    newly_high_exposure: float
    total_exposure: float


# ---------- settings / system configuration ----------


class SettingsResponse(BaseModel):
    band_thresholds: dict[str, float]
    gbm_blend_weight: float
    cox_blend_weight: float
    cox_horizon_duration: float
    embedding_model: str
    segments: list[str]
    total_borrowers: int
    last_scored_at: float
