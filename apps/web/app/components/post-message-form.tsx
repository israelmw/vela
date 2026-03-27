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
      router.push(`/console/runs/${json.runId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack terminal-composer" onSubmit={onSubmit}>
      <label className="label mono" htmlFor="msg">
        {">"} prompt input (try <code>echo: hello</code> /{" "}
        <code>risky: change</code> / plain text)
      </label>
      <textarea
        id="msg"
        className="input mono"
        rows={3}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder="ask vela…"
      />
      <div className="row">
        <button type="submit" className="btn" disabled={busy || !text.trim()}>
          {busy ? "running..." : "run turn"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </form>
  );
}
