import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWatchlist } from "../api";
import type { WatchlistItem } from "../types";
import BandTag from "../components/BandTag";

const BANDS = ["High", "Elevated", "Watch"] as const;

export default function Watchlist({
  segments,
}: {
  bandThresholds?: { high: number; elevated: number };
  segments: string[];
}) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [segment, setSegment] = useState("");
  const [band, setBand] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetchWatchlist({ segment: segment || undefined, band: band || undefined, limit, offset })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [segment, band, offset]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", margin: 0 }}>
          WATCHLIST — RANKED BY EXPOSURE AT RISK
        </h1>
        <div style={{ flex: 1 }} />
        <select
          className="mono"
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setOffset(0);
          }}
          style={{ background: "var(--panel-alt)", color: "var(--text)", border: "1px solid var(--border)", padding: "6px 8px" }}
        >
          <option value="">ALL SEGMENTS</option>
          {segments.map((s) => (
            <option key={s} value={s}>
              {s.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className="mono"
          value={band}
          onChange={(e) => {
            setBand(e.target.value);
            setOffset(0);
          }}
          style={{ background: "var(--panel-alt)", color: "var(--text)", border: "1px solid var(--border)", padding: "6px 8px" }}
        >
          <option value="">ALL BANDS</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <table className="mono" style={{ fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--panel-alt)", textAlign: "left" }}>
              <Th>BORROWER ID</Th>
              <Th>SEGMENT</Th>
              <Th align="right">EXPOSURE AT RISK</Th>
              <Th align="right">PD SCORE</Th>
              <Th>BAND</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.borrower_id}
                onClick={() => navigate(`/loans/${item.borrower_id}`)}
                style={{
                  borderTop: "1px solid var(--border)",
                  background: i % 2 === 0 ? "var(--panel)" : "var(--panel-alt)",
                  cursor: "pointer",
                }}
              >
                <Td>{item.borrower_id}</Td>
                <Td>{item.segment}</Td>
                <Td align="right">
                  {item.exposure_at_risk.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </Td>
                <Td align="right">{item.pd_score.toFixed(1)}</Td>
                <Td>
                  <BandTag band={item.band} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <div className="mono" style={{ padding: 16, color: "var(--text-dim)" }}>
            LOADING…
          </div>
        )}
      </div>

      <div
        className="mono"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        <span>
          {offset + 1}–{Math.min(offset + limit, total)} of {total}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="mono"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            style={pagerStyle}
          >
            PREV
          </button>
          <button
            className="mono"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            style={pagerStyle}
          >
            NEXT
          </button>
        </div>
      </div>
    </div>
  );
}

const pagerStyle: CSSProperties = {
  background: "var(--panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "4px 10px",
  fontSize: 11,
};

function Th({ children, align }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "8px 12px", textAlign: align ?? "left", fontWeight: 700, color: "var(--text-dim)" }}>
      {children}
    </th>
  );
}

function Td({ children, align }: { children: ReactNode; align?: "left" | "right" }) {
  return <td style={{ padding: "8px 12px", textAlign: align ?? "left" }}>{children}</td>;
}
