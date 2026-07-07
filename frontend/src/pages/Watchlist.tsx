import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWatchlist } from "../api";
import type { SummaryResponse, WatchlistItem } from "../types";
import BandTag from "../components/BandTag";

const BANDS = ["High", "Elevated", "Watch"] as const;

export default function Watchlist({
  segments,
  summary,
  onRescore,
  rescoring,
}: {
  bandThresholds?: { high: number; elevated: number };
  segments: string[];
  summary: SummaryResponse | null;
  onRescore: () => void;
  rescoring: boolean;
}) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [segment, setSegment] = useState("");
  const [band, setBand] = useState("");
  const [search, setSearch] = useState("");
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

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      navigate(`/loans/${search.trim()}`);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Stress watchlist, next 12 months</h1>
      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 20px" }}>
        Ranked by exposure at risk. Scored nightly.{" "}
        <button
          onClick={onRescore}
          disabled={rescoring}
          style={{ border: "none", background: "none", color: "var(--accent)", fontSize: 12, padding: 0, textDecoration: "underline" }}
        >
          {rescoring ? "Rescoring…" : "Run overnight rescore now"}
        </button>
      </p>

      {summary && (
        <div style={{ display: "flex", gap: 1, marginBottom: 20, border: "1px solid var(--border)", background: "var(--border)" }}>
          <Stat label="Total loans" value={summary.total_borrowers.toLocaleString()} />
          <Stat label="High risk" value={String(summary.band_counts.High ?? 0)} accent />
          <Stat label="Elevated" value={String(summary.band_counts.Elevated ?? 0)} />
          <Stat label="Total exposure at risk" value={`Rs ${(summary.total_exposure / 10000000).toFixed(1)} Cr`} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKey}
          placeholder="Search loan ID, press Enter"
          style={{ ...fieldStyle, flex: "1 1 220px" }}
        />
        <select
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setOffset(0);
          }}
          style={fieldStyle}
        >
          <option value="">Segment: all</option>
          {segments.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={band}
          onChange={(e) => {
            setBand(e.target.value);
            setOffset(0);
          }}
          style={fieldStyle}
        >
          <option value="">Band: all</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--panel-alt)", textAlign: "left" }}>
              <Th>Loan ID</Th>
              <Th>Segment</Th>
              <Th align="right">PD</Th>
              <Th>Band</Th>
              <Th align="right">Rs at risk</Th>
              <Th align="right">Action</Th>
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
                <Td align="right" className="num">
                  {item.pd_score.toFixed(2)}
                </Td>
                <Td>
                  <BandTag band={item.band} />
                </Td>
                <Td align="right" className="num">
                  {item.exposure_at_risk.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </Td>
                <Td align="right">
                  <span style={{ ...outlineButtonStyle, display: "inline-block" }}>View</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>Loading…</div>}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          fontSize: 12,
          color: "var(--text-dim)",
        }}
      >
        <span>
          {offset + 1} to {Math.min(offset + limit, total)} of {total}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} style={outlineButtonStyle}>
            Prev
          </button>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} style={outlineButtonStyle}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "8px 10px",
  fontSize: 13,
};

const outlineButtonStyle: CSSProperties = {
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--border-strong)",
  padding: "5px 12px",
  fontSize: 12,
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: "var(--panel)", padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "10px 14px", textAlign: align ?? "left", fontWeight: 600, fontSize: 12, color: "var(--text-dim)" }}>
      {children}
    </th>
  );
}

function Td({ children, align, className }: { children: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={className} style={{ padding: "10px 14px", textAlign: align ?? "left" }}>
      {children}
    </td>
  );
}
