import { useState } from "react";
import { generateMemo, memoDownloadUrl } from "../api";
import type { MemoResponse } from "../types";

export default function MemoPanel({ borrowerId }: { borrowerId: number }) {
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateMemo(borrowerId);
      setMemo(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "memo generation failed");
      setMemo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)" }}>Action memo</div>
        <div style={{ flex: 1 }} />
        <button
          onClick={generate}
          disabled={loading}
          style={{
            background: "var(--accent)",
            color: "#ffffff",
            border: "none",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {loading ? "Generating…" : "Generate memo"}
        </button>
      </div>

      {error && <p style={{ color: "var(--text)", fontSize: 12, marginTop: 8 }}>{error}</p>}

      {memo && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>{memo.summary}</p>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>Generated {memo.generated_at}</div>
          <a
            href={memoDownloadUrl(memo.pdf_url)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
