import { eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { approvals, runs, runSteps, sessions } from "@vela/db";
import { appendMessage, completeRun } from "@vela/control-plane";
import {
  createBuiltinWorkflowStepExecutor,
  drainWorkflowSteps,
} from "@vela/workflow";
import { executeApprovedBuiltinTool } from "@vela/tool-router";
import type { ApprovalVote } from "@vela/types";
import { expireStaleApprovals, parseVotes } from "./approvals";
import { runAgentTurn } from "./loop";
import { runChildSubagentRun } from "./subagent";

export type ResumeApprovedResult =
  | { runId: string; output: unknown }
  | { error: string }
  | {
      quorumPending: true;
      approveCount: number;
      quorumRequired: number;
    };

export async function resumeApprovedToolCall(
  db: DB,
  params: {
    approvalId: string;
    resolvedBy: string;
  },
): Promise<ResumeApprovedResult> {
  await expireStaleApprovals(db);

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

  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, appr.runId))
    .limit(1);

  if (!run) {
    return { error: "Run not found" };
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, run.sessionId))
    .limit(1);

  if (!session) {
    return { error: "Session not found" };
  }

  const payload = appr.payload as { toolId?: string; args?: unknown };

  if (!payload.toolId) {
    return { error: "Invalid approval payload" };
  }

  const by = params.resolvedBy;
  const prev = parseVotes(appr.votes);
  const dupApprove = prev.some((v) => v.actor === by && v.action === "approve");
  const nextVotes: ApprovalVote[] = dupApprove
    ? prev
    : [
        ...prev,
        {
          actor: by,
          action: "approve",
          at: new Date().toISOString(),
        },
      ];

  const approveCount = nextVotes.filter((v) => v.action === "approve").length;
  const quorumRequired = appr.quorumRequired ?? 1;

  if (approveCount < quorumRequired) {
    await db
      .update(approvals)
      .set({ votes: nextVotes as unknown as object })
      .where(eq(approvals.id, appr.id));
    return {
      quorumPending: true,
      approveCount,
      quorumRequired,
    };
  }

  await db
    .update(approvals)
    .set({
      votes: nextVotes as unknown as object,
      status: "approved",
      resolvedAt: new Date(),
      resolvedBy: by,
    })
    .where(eq(approvals.id, params.approvalId));

  const result = await executeApprovedBuiltinTool(db, {
    agentId: run.agentId,
    tenantId: session.tenantId,
    sessionId: session.id,
    toolId: payload.toolId,
    args: payload.args ?? {},
  });

  if (!result.ok) {
    await db
      .update(runSteps)
      .set({ status: "failed", endedAt: new Date() })
      .where(eq(runSteps.id, appr.runStepId));

    await completeRun(db, run.id, null, result.error);
    return { error: result.error };
  }

  await db
    .update(runSteps)
    .set({
      status: "completed",
      toolResult: result.output as object,
      endedAt: new Date(),
    })
    .where(eq(runSteps.id, appr.runStepId));

  const summary = JSON.stringify(result.output);
  await appendMessage(db, {
    sessionId: run.sessionId,
    threadId: session.threadId,
    role: "assistant",
    content: { text: summary },
  });

  await db
    .update(runs)
    .set({ status: "running", requiresApproval: false })
    .where(eq(runs.id, run.id));

  const executor = createBuiltinWorkflowStepExecutor({
    db,
    agentId: run.agentId,
    tenantId: session.tenantId,
    sessionId: run.sessionId,
    runId: run.id,
    spawnSubagent: ({ goal }) =>
      runChildSubagentRun(
        db,
        {
          id: run.id,
          sessionId: run.sessionId,
          agentId: run.agentId,
          subagentDepth: run.subagentDepth,
        },
        goal,
        (d, id) => runAgentTurn(d, id),
      ),
  });

  const drain = await drainWorkflowSteps(db, {
    runId: run.id,
    agentId: run.agentId,
    tenantId: session.tenantId,
    sessionId: run.sessionId,
    executor,
    maxSteps: 40,
  });

  if (drain.halt === "approval") {
    return { runId: run.id, output: result.output };
  }

  if (drain.halt === "fatal") {
    await completeRun(db, run.id, null, drain.message ?? "workflow failed");
    return { error: drain.message ?? "workflow failed" };
  }

  if (drain.done) {
    await completeRun(db, run.id, summary.slice(0, 500), null);
  } else {
    await completeRun(
      db,
      run.id,
      null,
      drain.message ?? "workflow did not complete",
    );
    return { error: drain.message ?? "workflow did not complete" };
  }

  return { runId: run.id, output: result.output };
}
