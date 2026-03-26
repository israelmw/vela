"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalActions(props: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${props.approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, by: "dashboard" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row gap">
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => act("approve")}
      >
        Approve
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={() => act("reject")}
      >
        Reject
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
