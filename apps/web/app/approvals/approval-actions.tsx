"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalActions(props: {
  approvalId: string;
  quorumRequired: number;
  approveHint?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [quorumMsg, setQuorumMsg] = useState<string | null>(
    props.approveHint ?? null,
  );

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      if (action === "reject" && !rejectReason.trim()) {
        setError("Rejection reason is required.");
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/approvals/${props.approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          by: "dashboard",
          ...(action === "reject" ? { reason: rejectReason.trim() } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        quorumPending?: boolean;
        approveCount?: number;
        quorumRequired?: number;
      };
      if (!res.ok) {
        setError(json.error ?? res.statusText);
        return;
      }
      if (json.quorumPending) {
        setQuorumMsg(
          `Quorum: ${json.approveCount ?? 0} / ${json.quorumRequired ?? props.quorumRequired} approvals`,
        );
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
    <div className="stack">
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
      </div>
      <label className="stack">
        <span className="muted small">Reject reason (required)</span>
        <textarea
          className="input"
          rows={2}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Explain why this approval is denied…"
        />
      </label>
      {props.quorumRequired > 1 ? (
        <p className="muted small">
          Quorum required: {props.quorumRequired} approvers
        </p>
      ) : null}
      {quorumMsg ? <p className="muted small">{quorumMsg}</p> : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
