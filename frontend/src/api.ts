import type {
  LoanDetail,
  MemoResponse,
  NewLoanRequest,
  RescoreResponse,
  ScoreResponse,
  SummaryResponse,
  WatchlistResponse,
  WhatIfRequest,
  WhatIfResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function scoreNewLoan(payload: NewLoanRequest): Promise<ScoreResponse> {
  return post<ScoreResponse>("/api/score", payload);
}

export function runWhatIf(borrowerId: number, payload: WhatIfRequest): Promise<WhatIfResponse> {
  return post<WhatIfResponse>(`/api/loans/${borrowerId}/what-if`, payload);
}

export function generateMemo(borrowerId: number): Promise<MemoResponse> {
  return post<MemoResponse>(`/api/loans/${borrowerId}/memo`);
}

export function memoDownloadUrl(pdfUrl: string): string {
  return `${BASE_URL}${pdfUrl}`;
}

export function fetchSummary(): Promise<SummaryResponse> {
  return get<SummaryResponse>("/api/summary");
}

export function fetchWatchlist(params: {
  segment?: string;
  band?: string;
  limit?: number;
  offset?: number;
}): Promise<WatchlistResponse> {
  const qs = new URLSearchParams();
  if (params.segment) qs.set("segment", params.segment);
  if (params.band) qs.set("band", params.band);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  return get<WatchlistResponse>(`/api/watchlist?${qs.toString()}`);
}

export function fetchLoanDetail(borrowerId: number): Promise<LoanDetail> {
  return get<LoanDetail>(`/api/loans/${borrowerId}`);
}

export function triggerRescore(): Promise<RescoreResponse> {
  return post<RescoreResponse>("/api/rescore");
}
