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
    <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 16, marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-dim)", marginBottom: 4 }}>
        WHAT-IF SIMULATOR
      </div>
      <p className="mono" style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 12 }}>
        Rate + tenure are converted to a monthly payment via the standard reducing-balance EMI
        formula, then run through the real trained model as a going-forward restructure — this can
        raise the score as well as lower it, if the resulting payment is weaker than what the
        borrower already pays. Principal directly overrides outstanding balance, a real trained
        feature.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <label className="mono" style={labelStyle}>
          NEW RATE (% p.a.)
          <input className="mono" style={inputStyle} type="number" value={ratePct}
            onChange={(e) => setRatePct(Number(e.target.value))} />
        </label>
        <label className="mono" style={labelStyle}>
          NEW TENURE (months)
          <input className="mono" style={inputStyle} type="number" value={tenureMonths}
            onChange={(e) => setTenureMonths(Number(e.target.value))} />
        </label>
        <label className="mono" style={labelStyle}>
          NEW PRINCIPAL (Rs, optional)
          <input className="mono" style={inputStyle} type="number" placeholder="unchanged" value={principal}
            onChange={(e) => setPrincipal(e.target.value)} />
        </label>
        <button className="mono" onClick={recompute} disabled={loading} style={buttonStyle}>
          {loading ? "RECOMPUTING…" : "RECOMPUTE"}
        </button>
      </div>

      {error && <p className="mono" style={{ color: "var(--high)", fontSize: 11 }}>{error}</p>}

      {result && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          <div className="mono" style={{ fontSize: 20 }}>
            {result.original_pd_score.toFixed(1)} <BandTag band={result.original_band} />
            <span style={{ margin: "0 10px", color: "var(--text-dim)" }}>&rarr;</span>
            {result.new_pd_score.toFixed(1)} <BandTag band={result.new_band} />
          </div>
          <span
            className="mono"
            style={{ fontSize: 12, color: result.delta > 0 ? "var(--high)" : "var(--green-bright)" }}
          >
            {result.delta > 0 ? "+" : ""}
            {result.delta.toFixed(1)} pts
          </span>
          {result.applied_emi != null && (
            <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
              applied EMI: {result.applied_emi.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
  fontSize: 10,
  color: "var(--text-dim)",
};

const inputStyle: CSSProperties = {
  width: 140,
  background: "var(--panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "6px 8px",
  fontSize: 12,
};

const buttonStyle: CSSProperties = {
  alignSelf: "flex-end",
  background: "var(--orange)",
  color: "#0b120e",
  border: "none",
  padding: "8px 14px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  height: 32,
};
