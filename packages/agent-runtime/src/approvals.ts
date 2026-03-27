import { and, eq, isNotNull, lt } from "drizzle-orm";
import type { DB } from "@vela/db";
import { approvals, runs, runSteps } from "@vela/db";
import type { ApprovalVote } from "@vela/types";

export async function expireStaleApprovals(
  db: DB,
  now: Date = new Date(),
): Promise<number> {
  const stale = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.status, "pending"),
        isNotNull(approvals.expiresAt),
        lt(approvals.expiresAt, now),
      ),
    );

  for (const row of stale) {
    await db
      .update(approvals)
      .set({ status: "expired", resolvedAt: now })
      .where(eq(approvals.id, row.id));

    await db
      .update(runSteps)
      .set({ status: "skipped", endedAt: now })
      .where(eq(runSteps.id, row.runStepId));

    await db
      .update(runs)
      .set({
        status: "failed",
        error: "approval expired",
        endedAt: now,
      })
      .where(eq(runs.id, row.runId));
  }

  return stale.length;
}

export function parseVotes(raw: unknown): ApprovalVote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is ApprovalVote =>
      v !== null &&
      typeof v === "object" &&
      typeof (v as ApprovalVote).actor === "string" &&
      ((v as ApprovalVote).action === "approve" ||
        (v as ApprovalVote).action === "reject") &&
      typeof (v as ApprovalVote).at === "string",
  );
}

export type RejectApprovalResult =
  | { ok: true }
  | { error: string };

/**
 * Reject a pending approval (any reject finalizes; reason is mandatory for audit).
 */
export async function rejectApproval(
  db: DB,
  params: {
    approvalId: string;
    actor: string;
    reason: string;
  },
): Promise<RejectApprovalResult> {
  await expireStaleApprovals(db);

  const reason = params.reason.trim();
  if (!reason) {
    return { error: "rejection reason is required" };
  }

  const [appr] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, params.approvalId))
    .limit(1);

  if (!appr) {
    return { error: "Approval not found" };
  }

  if (appr.status !== "pending") {
    return { error: "Approval is not pending" };
  }

  if (appr.expiresAt && appr.expiresAt < new Date()) {
    await db
      .update(approvals)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(approvals.id, appr.id));
    return { error: "Approval expired" };
  }

  const prev = parseVotes(appr.votes);
  const vote: ApprovalVote = {
    actor: params.actor,
    action: "reject",
    at: new Date().toISOString(),
    reason,
  };
  const nextVotes = [...prev, vote];

  const now = new Date();
  await db
    .update(approvals)
    .set({
      status: "rejected",
      resolvedAt: now,
      resolvedBy: params.actor,
      rejectionReason: reason,
      votes: nextVotes as unknown as object,
    })
    .where(eq(approvals.id, params.approvalId));

  await db
    .update(runSteps)
    .set({ status: "skipped", endedAt: now })
    .where(eq(runSteps.id, appr.runStepId));

  await db
    .update(runs)
    .set({
      status: "cancelled",
      endedAt: now,
      error: `approval rejected: ${reason}`,
    })
    .where(eq(runs.id, appr.runId));

  return { ok: true };
}
