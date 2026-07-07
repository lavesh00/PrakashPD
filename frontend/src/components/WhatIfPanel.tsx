import { useState, type CSSProperties } from "react";
import { runWhatIf } from "../api";
import type { WhatIfResponse } from "../types";
import BandTag from "./BandTag";

export default function WhatIfPanel({ borrowerId }: { borrowerId: number }) {
  const [ratePct, setRatePct] = useState(10);
  const [tenureMonths, setTenureMonths] = useState(36);
  const [principal, setPrincipal] = useState<string>("");
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recompute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runWhatIf(borrowerId, {
        new_rate_pct: ratePct,
        new_tenure_months: tenureMonths,
        new_principal: principal ? Number(principal) : undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "what-if failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 4 }}>What-if simulator</div>
      <p style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
        Rate and tenure are converted to a monthly payment via the standard reducing-balance EMI
        formula, then run through the real trained model as a going-forward restructure. This can
        raise the score as well as lower it, if the resulting payment is weaker than what the
        borrower already pays. Principal directly overrides outstanding balance, a real trained
        feature.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <label style={labelStyle}>
          New rate (% p.a.)
          <input style={inputStyle} type="number" value={ratePct} onChange={(e) => setRatePct(Number(e.target.value))} />
        </label>
        <label style={labelStyle}>
          New tenure (months)
          <input style={inputStyle} type="number" value={tenureMonths} onChange={(e) => setTenureMonths(Number(e.target.value))} />
        </label>
        <label style={labelStyle}>
          New principal (Rs, optional)
          <input style={inputStyle} type="number" placeholder="unchanged" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </label>
        <button onClick={recompute} disabled={loading} style={buttonStyle}>
          {loading ? "Recomputing…" : "Recompute"}
        </button>
      </div>

      {error && <p style={{ color: "var(--text)", fontSize: 12 }}>{error}</p>}

      {result && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          <div className="num" style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{result.original_pd_score.toFixed(1)}</span>
            <BandTag band={result.original_band} />
            <span style={{ color: "var(--text-dim)" }}>&rarr;</span>
            <span style={{ fontWeight: 700 }}>{result.new_pd_score.toFixed(1)}</span>
            <BandTag band={result.new_band} />
          </div>
          <span
            className="num"
            style={{ fontSize: 12, fontWeight: 600, color: result.delta > 0 ? "var(--text)" : "var(--accent)" }}
          >
            {result.delta > 0 ? "+" : ""}
            {result.delta.toFixed(1)} pts
          </span>
          {result.applied_emi != null && (
            <span className="num" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Applied EMI: {result.applied_emi.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "var(--text-dim)",
};

const inputStyle: CSSProperties = {
  width: 140,
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "7px 9px",
  fontSize: 13,
};

const buttonStyle: CSSProperties = {
  alignSelf: "flex-end",
  background: "var(--accent)",
  color: "#ffffff",
  border: "none",
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  height: 34,
};
