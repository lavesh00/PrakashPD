import { useState, type CSSProperties } from "react";
import { runPortfolioStressTest } from "../api";
import type { StressScenario, StressTestResponse } from "../types";
import Section from "../components/Section";

const SCENARIOS: { value: StressScenario; label: string; unit: string; help: string }[] = [
  {
    value: "utilization_shock",
    label: "Utilization shock",
    unit: "% increase in outstanding balances",
    help: "Outstanding balances rise by this percent across the whole book (credit limits unchanged), simulating a broad draw-down on existing credit lines.",
  },
  {
    value: "delinquency_shock",
    label: "Delinquency shock",
    unit: "notch(es) worse repayment status",
    help: "Repayment status shifts this many notches worse across the whole book, simulating a broad ability-to-pay shock (e.g. a downturn).",
  },
];

export default function PortfolioStressTest() {
  const [scenario, setScenario] = useState<StressScenario>("delinquency_shock");
  const [magnitude, setMagnitude] = useState(1);
  const [result, setResult] = useState<StressTestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = SCENARIOS.find((s) => s.value === scenario)!;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runPortfolioStressTest({ scenario, magnitude });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "stress test failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Portfolio stress test</h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Applies a book-wide scenario to the real feature book and genuinely re-runs the trained
        GBM, Cox, and isotonic pipeline over every loan (not a fabricated macro model). RM notes
        are not re-generated under stress, so only structured features move.
      </p>

      <Section title="Scenario">
        <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
          {SCENARIOS.map((s) => (
            <label key={s.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="radio"
                checked={scenario === s.value}
                onChange={() => setScenario(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>{active.help}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--text-dim)" }}>
            Magnitude ({active.unit})
            <input
              style={inputStyle}
              type="number"
              value={magnitude}
              onChange={(e) => setMagnitude(Number(e.target.value))}
            />
          </label>
          <button onClick={run} disabled={loading} style={buttonStyle}>
            {loading ? "Running…" : "Run stress test"}
          </button>
        </div>
      </Section>

      {error && <p style={{ color: "var(--text)" }}>{error}</p>}

      {result && (
        <>
          <div
            style={{
              display: "flex",
              gap: 1,
              marginBottom: 20,
              border: "1px solid var(--border)",
              background: "var(--border)",
            }}
          >
            <Stat label="Loans newly High-risk" value={result.newly_high_count.toLocaleString()} accent />
            <Stat
              label="Exposure newly High-risk"
              value={`Rs ${(result.newly_high_exposure / 10000000).toFixed(2)} Cr`}
              accent
            />
            <Stat label="Total book exposure" value={`Rs ${(result.total_exposure / 10000000).toFixed(1)} Cr`} />
          </div>

          <div className="detail-grid">
            <Section title="Band counts">
              <BandCompare before={result.band_counts_before} after={result.band_counts_after} />
            </Section>
            <Section title="Exposure at risk by band (Rs)">
              <BandCompare
                before={result.exposure_before}
                after={result.exposure_after}
                format={(v) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function BandCompare({
  before,
  after,
  format,
}: {
  before: Record<string, number>;
  after: Record<string, number>;
  format?: (v: number) => string;
}) {
  const bands = ["Watch", "Elevated", "High"];
  const fmt = format ?? ((v: number) => v.toLocaleString());
  return (
    <table style={{ fontSize: 13, width: "100%" }}>
      <thead>
        <tr style={{ textAlign: "left" }}>
          <th style={{ fontWeight: 600, color: "var(--text-dim)", fontSize: 12, padding: "4px 0" }}>Band</th>
          <th style={{ fontWeight: 600, color: "var(--text-dim)", fontSize: 12, padding: "4px 0", textAlign: "right" }}>
            Before
          </th>
          <th style={{ fontWeight: 600, color: "var(--text-dim)", fontSize: 12, padding: "4px 0", textAlign: "right" }}>
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {bands.map((b) => (
          <tr key={b} style={{ borderTop: "1px solid var(--border)" }}>
            <td style={{ padding: "6px 0" }}>{b}</td>
            <td className="num" style={{ padding: "6px 0", textAlign: "right" }}>
              {fmt(before[b] ?? 0)}
            </td>
            <td
              className="num"
              style={{
                padding: "6px 0",
                textAlign: "right",
                fontWeight: (after[b] ?? 0) > (before[b] ?? 0) ? 700 : 400,
                color: b === "High" && (after[b] ?? 0) > (before[b] ?? 0) ? "var(--accent)" : "var(--text)",
              }}
            >
              {fmt(after[b] ?? 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: "var(--panel)", padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: 220,
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "7px 9px",
  fontSize: 13,
};

const buttonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "#ffffff",
  border: "none",
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  height: 34,
};
