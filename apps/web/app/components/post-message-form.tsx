"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PostMessageForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/events/web", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as { error?: string; runId?: string };
      if (!res.ok) {
        setError(json.error ?? res.statusText);
        return;
      }
      setText("");
      router.push(`/runs/${json.runId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="label" htmlFor="msg">
        Send a message (try{" "}
        <code className="mono">echo: hello</code>,{" "}
        <code className="mono">risky: change</code>, or plain text for the model)
      </label>
      <textarea
        id="msg"
        className="input"
        rows={3}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder="Hello Vela"
      />
      <div className="row">
        <button type="submit" className="btn" disabled={busy || !text.trim()}>
          {busy ? "Running…" : "Run turn"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </form>
  );
}
