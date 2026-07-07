import type { ReasonCode } from "../types";

export default function ReasonCodeList({ reasons }: { reasons: ReasonCode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {reasons.map((r, i) => (
        <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
          {r.text}
          {r.is_nlp && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 600,
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                padding: "1px 6px",
                whiteSpace: "nowrap",
              }}
            >
              unstructured signal
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
