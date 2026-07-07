import type { ReactNode } from "react";

export default function Section({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        background: "var(--panel)",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: accent ? "var(--accent)" : "var(--text-dim)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
