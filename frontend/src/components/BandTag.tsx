import type { Band } from "../types";

const MARKER: Record<Band, { background: string; border: string }> = {
  Watch: { background: "transparent", border: "var(--border-strong)" },
  Elevated: { background: "var(--elevated-fill)", border: "var(--elevated-fill)" },
  High: { background: "var(--accent)", border: "var(--accent)" },
};

export default function BandTag({ band }: { band: Band }) {
  const marker = MARKER[band] ?? MARKER.Watch;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 9,
          height: 9,
          background: marker.background,
          border: `1px solid ${marker.border}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: band === "High" ? 700 : 500,
          color: band === "High" ? "var(--accent)" : "var(--text)",
        }}
      >
        {band}
      </span>
    </span>
  );
}
