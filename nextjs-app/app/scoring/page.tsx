"use client";

import { useState } from "react";

export default function ScoringPage() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [output, setOutput] = useState("");

  async function runScoring() {
    setStatus("running");
    setOutput("");
    try {
      const res = await fetch("/api/scoring/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.output);
        setStatus("done");
      } else {
        setOutput(data.error || "Unknown error");
        setStatus("error");
      }
    } catch (err) {
      setOutput(String(err));
      setStatus("error");
    }
  }

  return (
    <>
      <h1 style={{ marginBottom: "0.5rem" }}>Run Scoring</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Execute the ML inference script to score all unscored orders for late delivery risk.
      </p>

      <div className="card">
        <button
          className="btn btn-primary"
          onClick={runScoring}
          disabled={status === "running"}
          style={{ fontSize: "1.1rem", padding: "0.75rem 2rem" }}
        >
          {status === "running" ? "Scoring..." : "Run ML Scoring"}
        </button>

        {output && (
          <pre
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "#111827",
              color: status === "error" ? "#fca5a5" : "#86efac",
              borderRadius: 8,
              fontSize: "0.85rem",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {output}
          </pre>
        )}

        {status === "done" && (
          <p style={{ marginTop: "1rem" }}>
            <a href="/warehouse/priority">View Priority Queue &rarr;</a>
          </p>
        )}
      </div>
    </>
  );
}
