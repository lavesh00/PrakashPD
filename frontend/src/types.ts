export type Band = "Watch" | "Elevated" | "High";

export interface ReasonCode {
  text: string;
  is_nlp: boolean;
}

export interface WatchlistItem {
  borrower_id: number;
  segment: string;
  pd_score: number;
  band: Band;
  exposure_at_risk: number;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface LoanDetail {
  borrower_id: number;
  segment: string;
  pd_score: number;
  band: Band;
  exposure_at_risk: number;
  rm_note: string;
  reason_codes: ReasonCode[];
  recommended_action: string;
}

export interface SummaryResponse {
  total_exposure: number;
  total_borrowers: number;
  band_counts: Record<string, number>;
  segments: string[];
  last_scored_at: number;
  band_thresholds: { high: number; elevated: number };
}

export interface RescoreResponse {
  scored_at: number;
  n_scored: number;
}

export type RepaymentHistory = "clean" | "minor_delay" | "moderate_delay" | "severe_delinquency";

export interface NewLoanRequest {
  loan_amount: number;
  age: number;
  tenure_months: number;
  annual_income?: number;
  existing_emi: number;
  credit_utilization_pct: number;
  repayment_history: RepaymentHistory;
  segment?: string;
  rm_note: string;
}

export interface ScoreResponse {
  pd_score: number;
  band: Band;
  reason_codes: ReasonCode[];
  recommended_action: string;
}

export interface WhatIfRequest {
  new_rate_pct?: number;
  new_tenure_months?: number;
  new_principal?: number;
  new_emi?: number;
}

export interface WhatIfResponse {
  borrower_id: number;
  original_pd_score: number;
  original_band: Band;
  new_pd_score: number;
  new_band: Band;
  delta: number;
  applied_emi: number | null;
  applied_principal: number | null;
}

export interface MemoResponse {
  borrower_id: number;
  segment: string;
  exposure_at_risk: number;
  pd_score: number;
  band: Band;
  reason_codes: ReasonCode[];
  recommended_intervention: string;
  summary: string;
  generated_at: string;
  pdf_url: string;
}

export interface FeatureImportanceEntry {
  feature: string;
  importance_pct: number;
  is_nlp: boolean;
}

export interface ModelPerformanceResponse {
  auc: number;
  gini: number;
  ks_statistic: number;
  recall_at_top_20pct: number;
  n_train: number;
  n_test: number;
  test_default_rate: number;
  band_thresholds: { high: number; elevated: number };
  band_distribution_test: Record<string, number>;
  feature_importance: FeatureImportanceEntry[];
  note: string;
}

export type StressScenario = "utilization_shock" | "delinquency_shock";

export interface StressTestRequest {
  scenario: StressScenario;
  magnitude: number;
}

export interface StressTestResponse {
  scenario: string;
  magnitude: number;
  band_counts_before: Record<string, number>;
  band_counts_after: Record<string, number>;
  exposure_before: Record<string, number>;
  exposure_after: Record<string, number>;
  newly_high_count: number;
  newly_high_exposure: number;
  total_exposure: number;
}

export interface SettingsResponse {
  band_thresholds: { high: number; elevated: number };
  gbm_blend_weight: number;
  cox_blend_weight: number;
  cox_horizon_duration: number;
  embedding_model: string;
  segments: string[];
  total_borrowers: number;
  last_scored_at: number;
}
