import { eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { approvals, runs, runSteps, sessions } from "@vela/db";
import { appendMessage, completeRun } from "@vela/control-plane";
import { executeApprovedBuiltinTool } from "@vela/tool-router";

export async function resumeApprovedToolCall(
  db: DB,
  params: {
    approvalId: string;
    resolvedBy: string;
  },
): Promise<{ runId: string; output: unknown } | { error: string }> {
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

  await db
    .update(approvals)
    .set({
      status: "approved",
      resolvedAt: new Date(),
      resolvedBy: params.resolvedBy,
    })
    .where(eq(approvals.id, params.approvalId));

  const result = await executeApprovedBuiltinTool(db, {
    agentId: run.agentId,
    tenantId: session.tenantId,
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

  await completeRun(db, run.id, summary.slice(0, 500), null);

  return { runId: run.id, output: result.output };
}
