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
    <div style={{ border: "1px solid var(--border)", background: "var(--panel)", padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-dim)" }}>
          ACTION MEMO
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="mono"
          onClick={generate}
          disabled={loading}
          style={{
            background: "var(--orange)",
            color: "#0b120e",
            border: "none",
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
          }}
        >
          {loading ? "GENERATING…" : "GENERATE MEMO"}
        </button>
      </div>

      {error && <p className="mono" style={{ color: "var(--high)", fontSize: 11, marginTop: 8 }}>{error}</p>}

      {memo && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>{memo.summary}</p>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8 }}>
            Generated {memo.generated_at}
          </div>
          <a
            className="mono"
            href={memoDownloadUrl(memo.pdf_url)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              border: "1px solid var(--orange)",
              color: "var(--orange-bright)",
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textDecoration: "none",
            }}
          >
            DOWNLOAD PDF
          </a>
        </div>
      )}
    </div>
  );
}
