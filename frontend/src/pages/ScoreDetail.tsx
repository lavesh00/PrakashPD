import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchLoanDetail } from "../api";
import type { LoanDetail } from "../types";
import BandTag from "../components/BandTag";
import ScoreBar from "../components/ScoreBar";
import ReasonCodeList from "../components/ReasonCodeList";
import Section from "../components/Section";
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
      <div>
        <Link to="/" style={{ fontSize: 12, color: "var(--text-dim)" }}>
          &larr; Back to watchlist
        </Link>
        <p style={{ color: "var(--text)" }}>{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        <Link to="/" style={{ fontSize: 12, color: "var(--text-dim)" }}>
          &larr; Back to watchlist
        </Link>
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400 }}>
      <Link to="/" style={{ fontSize: 12, color: "var(--text-dim)" }}>
        &larr; Back to watchlist
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Borrower #{detail.borrower_id}</h1>
        <BandTag band={detail.band} />
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{detail.segment}</span>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 24, marginBottom: 16 }}>
        <ScoreBar
          score={detail.pd_score}
          band={detail.band}
          highCut={bandThresholds?.high ?? 70}
          elevatedCut={bandThresholds?.elevated ?? 30}
        />
      </div>

      <div style={{ display: "flex", gap: 1, marginBottom: 20, border: "1px solid var(--border)", background: "var(--border)" }}>
        <Stat label="Exposure at risk" value={detail.exposure_at_risk.toLocaleString("en-IN", { maximumFractionDigits: 0 })} />
        <Stat label="Segment" value={detail.segment} />
        <Stat label="Band" value={detail.band} />
      </div>

      <div className="detail-grid">
        <div>
          <Section title="Top reason codes">
            <ReasonCodeList reasons={detail.reason_codes} />
          </Section>

          <Section title="RM note (unstructured signal)">
            <p style={{ margin: 0, fontStyle: "italic", color: "var(--text-dim)" }}>&ldquo;{detail.rm_note}&rdquo;</p>
          </Section>
        </div>

        <div>
          <Section title="Recommended action" accent>
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
    <div style={{ flex: 1, background: "var(--panel)", padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

