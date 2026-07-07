import type { Band } from "../types";

const COLORS: Record<Band, string> = {
  Watch: "var(--watch)",
  Elevated: "var(--elevated)",
  High: "var(--high)",
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
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span className="mono" style={{ fontSize: 42, fontWeight: 700, color: COLORS[band] }}>
          {score.toFixed(1)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
          / 100 PD SCORE
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 22,
          background: "var(--panel-alt)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${Math.min(score, 100)}%`,
            background: COLORS[band],
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${elevatedCut}%`,
            width: 1,
            background: "rgba(0,0,0,0.5)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${highCut}%`,
            width: 1,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <div
        className="mono"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text-dim)",
          marginTop: 4,
        }}
      >
        <span>0</span>
        <span>Elevated @ {elevatedCut.toFixed(0)}</span>
        <span>High @ {highCut.toFixed(0)}</span>
        <span>100</span>
      </div>
    </div>
  );
}
