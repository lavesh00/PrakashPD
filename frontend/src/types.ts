export type Band = "Watch" | "Elevated" | "High";

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
  reason_codes: string[];
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
  reason_codes: string[];
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
  reason_codes: string[];
  recommended_intervention: string;
  summary: string;
  generated_at: string;
  pdf_url: string;
}
