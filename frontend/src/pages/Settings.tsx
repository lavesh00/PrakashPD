import { useEffect, useState } from "react";
import { fetchSettings, triggerRescore } from "../api";
import type { SettingsResponse } from "../types";
import Section from "../components/Section";

export default function Settings() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [rescoring, setRescoring] = useState(false);

  const load = () => {
    fetchSettings().then(setData).catch(() => setData(null));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await triggerRescore();
      load();
    } finally {
      setRescoring(false);
    }
  };

  if (!data) {
    return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  }

  const lastScored = data.last_scored_at
    ? new Date(data.last_scored_at * 1000).toLocaleString()
    : "never";

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Settings</h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 20px" }}>
        Read-only view of the live model configuration. Nothing here is editable in this
        prototype; changing thresholds or blend weights means retraining (see README).
      </p>

      <Section title="Risk bands">
        <Row label="High cut" value={data.band_thresholds.high.toFixed(1)} />
        <Row label="Elevated cut" value={data.band_thresholds.elevated.toFixed(1)} />
      </Section>

      <Section title="Model composition">
        <Row label="GBM blend weight" value={data.gbm_blend_weight.toFixed(2)} />
        <Row label="Cox blend weight" value={data.cox_blend_weight.toFixed(2)} />
        <Row label="Cox horizon (cycles)" value={data.cox_horizon_duration.toFixed(1)} />
        <Row label="Text embedding model" value={data.embedding_model} />
      </Section>

      <Section title="Book">
        <Row label="Total borrowers" value={data.total_borrowers.toLocaleString()} />
        <Row label="Segments" value={data.segments.join(", ")} />
        <Row label="Last scored" value={lastScored} />
      </Section>

      <Section title="Operations" accent>
        <p style={{ margin: "0 0 12px" }}>
          Re-run the trained pipeline over the whole book now, simulating the overnight batch job.
        </p>
        <button
          onClick={handleRescore}
          disabled={rescoring}
          style={{
            background: "var(--accent)",
            color: "#ffffff",
            border: "none",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {rescoring ? "Rescoring…" : "Trigger overnight rescore"}
        </button>
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span className="num" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
