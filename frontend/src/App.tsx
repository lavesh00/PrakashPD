import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { fetchSummary, triggerRescore } from "./api";
import type { SummaryResponse } from "./types";
import Watchlist from "./pages/Watchlist";
import ScoreDetail from "./pages/ScoreDetail";
import ScoreNewLoan from "./pages/ScoreNewLoan";
import ModelPerformance from "./pages/ModelPerformance";
import PortfolioStressTest from "./pages/PortfolioStressTest";
import Settings from "./pages/Settings";

const NAV_ITEMS = [
  { label: "Watchlist", to: "/" },
  { label: "Score a new loan", to: "/score-new" },
  { label: "Model performance", to: "/model-performance" },
  { label: "Portfolio stress test", to: "/stress-test" },
  { label: "Settings", to: "/settings" },
];

export default function App() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const location = useLocation();

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
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 20, height: 20, background: "var(--text)", flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>PrakashPD</span>
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>RM officer</span>
      </header>

      <div style={{ flex: 1, display: "flex" }}>
        <nav
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            background: "var(--panel)",
            padding: "20px 0",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                  padding: "9px 20px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--text)" : "var(--text-dim)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main style={{ flex: 1, padding: 28, minWidth: 0 }}>
          <Routes>
            <Route
              path="/"
              element={
                <Watchlist
                  bandThresholds={summary?.band_thresholds}
                  segments={summary?.segments ?? []}
                  summary={summary}
                  onRescore={handleRescore}
                  rescoring={rescoring}
                />
              }
            />
            <Route path="/loans/:borrowerId" element={<ScoreDetail bandThresholds={summary?.band_thresholds} />} />
            <Route path="/score-new" element={<ScoreNewLoan bandThresholds={summary?.band_thresholds} />} />
            <Route path="/model-performance" element={<ModelPerformance />} />
            <Route path="/stress-test" element={<PortfolioStressTest />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
