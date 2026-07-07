import type { Band } from "../types";

const COLORS: Record<Band, string> = {
  Watch: "var(--watch)",
  Elevated: "var(--elevated)",
  High: "var(--high)",
};

export default function BandTag({ band }: { band: Band }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#0b120e",
        background: COLORS[band] ?? "var(--watch)",
      }}
    >
      {band}
    </span>
  );
}
