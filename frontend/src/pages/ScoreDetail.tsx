import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchLoanDetail } from "../api";
import type { LoanDetail } from "../types";
import BandTag from "../components/BandTag";
import ScoreBar from "../components/ScoreBar";
import WhatIfPanel from "../components/WhatIfPanel";
import MemoPanel from "../components/MemoPanel";

export default function ScoreDetail({
  bandThresholds,
}: {
  bandThresholds?: { high: number; elevated: number };
}) {
  const { borrowerId } = useParams();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!borrowerId) return;
    setDetail(null);
    setError(null);
    fetchLoanDetail(Number(borrowerId))
      .then(setDetail)
      .catch(() => setError("Loan not found"));
  }, [borrowerId]);

  if (error) {
    return (
      <div className="mono">
        <Link to="/">&larr; BACK TO WATCHLIST</Link>
        <p style={{ color: "var(--high)" }}>{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mono">
        <Link to="/">&larr; BACK TO WATCHLIST</Link>
        <p style={{ color: "var(--text-dim)" }}>LOADING…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400 }}>
      <Link to="/" className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
        &larr; BACK TO WATCHLIST
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 20px" }}>
        <h1 className="mono" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          BORROWER #{detail.borrower_id}
        </h1>
        <BandTag band={detail.band} />
        <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {detail.segment.toUpperCase()}
        </span>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 20, marginBottom: 16 }}>
        <ScoreBar
          score={detail.pd_score}
          band={detail.band}
          highCut={bandThresholds?.high ?? 70}
          elevatedCut={bandThresholds?.elevated ?? 30}
        />
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <Stat label="EXPOSURE AT RISK" value={detail.exposure_at_risk.toLocaleString("en-IN", { maximumFractionDigits: 0 })} />
        <Stat label="SEGMENT" value={detail.segment} />
        <Stat label="BAND" value={detail.band} />
      </div>

      <div className="detail-grid">
        <div>
          <Section title="TOP REASON CODES">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {detail.reason_codes.map((r, i) => (
                <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="RM NOTE">
            <p style={{ margin: 0, fontStyle: "italic", color: "var(--text-dim)" }}>&ldquo;{detail.rm_note}&rdquo;</p>
          </Section>
        </div>

        <div>
          <Section title="RECOMMENDED ACTION" accent>
            <p style={{ margin: 0 }}>{detail.recommended_action}</p>
          </Section>

          <WhatIfPanel borrowerId={detail.borrower_id} />

          <MemoPanel borrowerId={detail.borrower_id} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, border: "1px solid var(--border)", background: "var(--panel)", padding: "10px 14px" }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? "var(--orange)" : "var(--border)"}`,
        background: "var(--panel)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: accent ? "var(--orange-bright)" : "var(--text-dim)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
