import { useEffect, useState } from "react";
import { fetchModelPerformance } from "../api";
import type { ModelPerformanceResponse } from "../types";
import Section from "../components/Section";

export default function ModelPerformance() {
  const [data, setData] = useState<ModelPerformanceResponse | null>(null);

  useEffect(() => {
    fetchModelPerformance().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  }

  const maxImportance = Math.max(...data.feature_importance.map((f) => f.importance_pct));

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Model performance</h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 20px" }}>
        Real metrics from the trained pipeline&apos;s out-of-time holdout, not illustrative numbers.
      </p>

      <div style={{ display: "flex", gap: 1, marginBottom: 20, border: "1px solid var(--border)", background: "var(--border)" }}>
        <Stat label="AUC" value={data.auc.toFixed(3)} />
        <Stat label="Gini" value={data.gini.toFixed(3)} />
        <Stat label="KS statistic" value={data.ks_statistic.toFixed(3)} />
        <Stat label="Recall @ top 20%" value={`${(data.recall_at_top_20pct * 100).toFixed(1)}%`} />
      </div>

      <Section title="Why not accuracy">
        <p style={{ margin: 0, lineHeight: 1.6, color: "var(--text-dim)" }}>{data.note}</p>
      </Section>

      <div className="detail-grid">
        <Section title="Band distribution, test split">
          {Object.entries(data.band_distribution_test).map(([band, pct]) => (
            <div key={band} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>{band}</span>
                <span className="num">{(pct * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct * 100}%`,
                    background: band === "High" ? "var(--accent)" : "var(--elevated-fill)",
                  }}
                />
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 12, marginBottom: 0 }}>
            High cut {data.band_thresholds.high.toFixed(1)}, Elevated cut {data.band_thresholds.elevated.toFixed(1)}.
            n_train {data.n_train.toLocaleString()}, n_test {data.n_test.toLocaleString()}, test default rate{" "}
            {(data.test_default_rate * 100).toFixed(1)}%.
          </p>
        </Section>

        <Section title="Top feature importance (real, from the trained LightGBM booster)">
          {data.feature_importance.map((f) => (
            <div key={f.feature} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span>
                  {f.feature}
                  {f.is_nlp && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--accent)",
                        border: "1px solid var(--accent)",
                        padding: "0 5px",
                      }}
                    >
                      unstructured
                    </span>
                  )}
                </span>
                <span className="num">{f.importance_pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 5, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(f.importance_pct / maxImportance) * 100}%`,
                    background: f.is_nlp ? "var(--accent)" : "var(--elevated-fill)",
                  }}
                />
              </div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: "var(--panel)", padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
