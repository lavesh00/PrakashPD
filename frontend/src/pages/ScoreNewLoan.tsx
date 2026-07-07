import { useState, type CSSProperties, type ReactNode } from "react";
import { scoreNewLoan } from "../api";
import type { NewLoanRequest, RepaymentHistory, ScoreResponse } from "../types";
import BandTag from "../components/BandTag";
import ScoreBar from "../components/ScoreBar";

const SEGMENTS = ["Retail Personal", "Credit Card", "Consumer Durable", "SME", "Agri"];

const HIGH_RISK_EXAMPLE: NewLoanRequest = {
  loan_amount: 50000,
  age: 29,
  tenure_months: 24,
  annual_income: 400000,
  existing_emi: 200,
  credit_utilization_pct: 130,
  repayment_history: "severe_delinquency",
  segment: "Retail Personal",
  rm_note: "RM flags declining GST turnover, down 40% over two quarters.",
};

const LOW_RISK_EXAMPLE: NewLoanRequest = {
  loan_amount: 300000,
  age: 45,
  tenure_months: 24,
  annual_income: 1800000,
  existing_emi: 15000,
  credit_utilization_pct: 15,
  repayment_history: "clean",
  segment: "SME",
  rm_note: "Borrower reports steady GST turnover growth of 18% this quarter.",
};

const BLANK: NewLoanRequest = {
  loan_amount: 200000,
  age: 35,
  tenure_months: 24,
  annual_income: undefined,
  existing_emi: 5000,
  credit_utilization_pct: 40,
  repayment_history: "clean",
  segment: "Retail Personal",
  rm_note: "",
};

export default function ScoreNewLoan({
  bandThresholds,
}: {
  bandThresholds?: { high: number; elevated: number };
}) {
  const [form, setForm] = useState<NewLoanRequest>(BLANK);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof NewLoanRequest>(key: K, value: NewLoanRequest[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scoreNewLoan(form);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "scoring failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", margin: 0 }}>
          SCORE A NEW LOAN
        </h1>
        <div style={{ flex: 1 }} />
        <button className="mono" style={presetStyle} onClick={() => { setForm(HIGH_RISK_EXAMPLE); setResult(null); }}>
          LOAD HIGH-RISK EXAMPLE
        </button>
        <button className="mono" style={presetStyle} onClick={() => { setForm(LOW_RISK_EXAMPLE); setResult(null); }}>
          LOAD LOW-RISK EXAMPLE
        </button>
      </div>

      <p className="mono" style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 20 }}>
        This runs the real trained model live. Loan amount, age, repayment history, utilization,
        existing EMI, segment and the RM note all map onto trained features. Tenure and annual
        income are collected for context/memo purposes only — this model was trained on revolving
        credit-history data, which has no native "tenure" or "income" feature, so those two fields
        do not affect the score (see README).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 20 }}>
          <Field label="LOAN AMOUNT / CREDIT LIMIT (Rs)">
            <input className="mono" style={inputStyle} type="number" value={form.loan_amount}
              onChange={(e) => set("loan_amount", Number(e.target.value))} />
          </Field>
          <Field label="BORROWER AGE">
            <input className="mono" style={inputStyle} type="number" value={form.age}
              onChange={(e) => set("age", Number(e.target.value))} />
          </Field>
          <Field label="TENURE (MONTHS) — context only, not a trained feature">
            <input className="mono" style={inputStyle} type="number" value={form.tenure_months}
              onChange={(e) => set("tenure_months", Number(e.target.value))} />
          </Field>
          <Field label="ANNUAL INCOME (Rs) — context only, not a trained feature">
            <input className="mono" style={inputStyle} type="number" value={form.annual_income ?? ""}
              onChange={(e) => set("annual_income", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
          <Field label="SEGMENT">
            <select className="mono" style={inputStyle} value={form.segment}
              onChange={(e) => set("segment", e.target.value)}>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 20 }}>
          <Field label="EXISTING / EXPECTED EMI (Rs per month)">
            <input className="mono" style={inputStyle} type="number" value={form.existing_emi}
              onChange={(e) => set("existing_emi", Number(e.target.value))} />
          </Field>
          <Field label="CREDIT UTILIZATION (% OF LIMIT)">
            <input className="mono" style={inputStyle} type="number" value={form.credit_utilization_pct}
              onChange={(e) => set("credit_utilization_pct", Number(e.target.value))} />
          </Field>
          <Field label="REPAYMENT HISTORY (LAST 6 CYCLES)">
            <select className="mono" style={inputStyle} value={form.repayment_history}
              onChange={(e) => set("repayment_history", e.target.value as RepaymentHistory)}>
              <option value="clean">Clean — paid duly</option>
              <option value="minor_delay">Minor delay — ~1 month late pattern</option>
              <option value="moderate_delay">Moderate delay — ~2 months late pattern</option>
              <option value="severe_delinquency">Severe delinquency — 4+ months late pattern</option>
            </select>
          </Field>
          <Field label="RM NOTE / TRANSACTION NARRATIVE (FREE TEXT)">
            <textarea className="mono" style={{ ...inputStyle, height: 84, resize: "vertical" }} value={form.rm_note}
              onChange={(e) => set("rm_note", e.target.value)} />
          </Field>
        </div>
      </div>

      <button
        className="mono"
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 16,
          background: "var(--orange)",
          color: "#0b120e",
          border: "none",
          padding: "10px 20px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        {loading ? "SCORING…" : "SCORE THIS LOAN"}
      </button>

      {error && (
        <p className="mono" style={{ color: "var(--high)", marginTop: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <BandTag band={result.band} />
            <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              LIVE MODEL OUTPUT
            </span>
          </div>
          <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 20, marginBottom: 16 }}>
            <ScoreBar
              score={result.pd_score}
              band={result.band}
              highCut={bandThresholds?.high ?? 70}
              elevatedCut={bandThresholds?.elevated ?? 30}
            />
          </div>
          <Section title="TOP REASON CODES">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.reason_codes.map((r, i) => (
                <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          </Section>
          <Section title="RECOMMENDED ACTION" accent>
            <p style={{ margin: 0 }}>{result.recommended_action}</p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
        {label}
      </div>
      {children}
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

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "6px 8px",
  fontSize: 12,
};

const presetStyle: CSSProperties = {
  background: "var(--panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "6px 10px",
  fontSize: 11,
};
