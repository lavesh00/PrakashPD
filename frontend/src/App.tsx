import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { fetchSummary, triggerRescore } from "./api";
import type { SummaryResponse } from "./types";
import Watchlist from "./pages/Watchlist";
import ScoreDetail from "./pages/ScoreDetail";
import ScoreNewLoan from "./pages/ScoreNewLoan";

export default function App() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [rescoring, setRescoring] = useState(false);

  const loadSummary = () => {
    fetchSummary().then(setSummary).catch(() => setSummary(null));
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await triggerRescore();
      loadSummary();
    } finally {
      setRescoring(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
          padding: "12px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 24,
          rowGap: 10,
        }}
      >
        <Link to="/" style={{ textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
          <span
            className="mono"
            style={{ fontSize: 16, fontWeight: 700, color: "var(--orange-bright)", letterSpacing: "0.05em" }}
          >
            PRAKASHPD
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
            DEFAULT PREDICTION CONSOLE
          </span>
        </Link>

        <Link
          to="/score-new"
          className="mono"
          style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          SCORE A NEW LOAN
        </Link>

        <div style={{ flex: 1, minWidth: 0 }} />

        {summary && (
          <div
            className="mono"
            style={{ display: "flex", flexWrap: "wrap", rowGap: 4, gap: 20, fontSize: 11, color: "var(--text-dim)" }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              BORROWERS <b style={{ color: "var(--text)" }}>{summary.total_borrowers.toLocaleString()}</b>
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              EXPOSURE <b style={{ color: "var(--text)" }}>
                {(summary.total_exposure / 10000000).toFixed(1)} Cr
              </b>
            </span>
            <span style={{ color: "var(--high)", whiteSpace: "nowrap" }}>
              HIGH <b>{summary.band_counts.High ?? 0}</b>
            </span>
            <span style={{ color: "var(--elevated)", whiteSpace: "nowrap" }}>
              ELEVATED <b>{summary.band_counts.Elevated ?? 0}</b>
            </span>
            <span style={{ color: "var(--watch)", whiteSpace: "nowrap" }}>
              WATCH <b>{summary.band_counts.Watch ?? 0}</b>
            </span>
          </div>
        )}

        <button
          onClick={handleRescore}
          disabled={rescoring}
          className="mono"
          style={{
            background: "var(--orange)",
            color: "#0b120e",
            border: "none",
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {rescoring ? "RESCORING…" : "TRIGGER OVERNIGHT RESCORE"}
        </button>
      </header>

      <main style={{ flex: 1, padding: 24 }}>
        <Routes>
          <Route
            path="/"
            element={<Watchlist bandThresholds={summary?.band_thresholds} segments={summary?.segments ?? []} />}
          />
          <Route path="/loans/:borrowerId" element={<ScoreDetail bandThresholds={summary?.band_thresholds} />} />
          <Route path="/score-new" element={<ScoreNewLoan bandThresholds={summary?.band_thresholds} />} />
        </Routes>
      </main>
    </div>
  );
}
