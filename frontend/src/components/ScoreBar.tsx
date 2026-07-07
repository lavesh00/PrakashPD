import type { Band } from "../types";

const MARKER_COLOR: Record<Band, string> = {
  Watch: "var(--text-faint)",
  Elevated: "var(--elevated-fill)",
  High: "var(--accent)",
};

export default function ScoreBar({
  score,
  band,
  highCut,
  elevatedCut,
}: {
  score: number;
  band: Band;
  highCut: number;
  elevatedCut: number;
}) {
  const clamped = Math.max(0, Math.min(score, 100));
  const color = MARKER_COLOR[band] ?? MARKER_COLOR.Watch;

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width={116} height={116} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="9" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="square"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text)" className="num">
            {clamped.toFixed(1)}
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="10" fill="var(--text-dim)" letterSpacing="0.05em">
            PD · {band.toUpperCase()}
          </text>
        </svg>

        <div style={{ flex: 1 }}>
          <div
            style={{
              position: "relative",
              height: 2,
              background: "var(--border)",
              marginTop: 8,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -4,
                left: `calc(${clamped}% - 5px)`,
                width: 10,
                height: 10,
                background: color,
              }}
            />
            <div style={{ position: "absolute", top: -14, left: `${elevatedCut}%`, width: 1, height: 8, background: "var(--border-strong)" }} />
            <div style={{ position: "absolute", top: -14, left: `${highCut}%`, width: 1, height: 8, background: "var(--border-strong)" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-faint)",
              marginTop: 10,
            }}
          >
            <span>0</span>
            <span>Elevated @ {elevatedCut.toFixed(0)}</span>
            <span>High @ {highCut.toFixed(0)}</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
