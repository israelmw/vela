import { eq, max } from "drizzle-orm";
import type { DB } from "@vela/db";
import { runSteps, runs } from "@vela/db";

export type WorkflowStepSpec = {
  /** Drizzle run_step type */
  kind:
    | "reasoning"
    | "tool_call"
    | "approval_gate"
    | "artifact"
    | "subagent";
  label: string;
  toolName?: string | null;
  toolInput?: unknown;
  maxAttempts?: number;
  idempotencyKey?: string;
};

/**
 * Minimal linear workflow: records placeholder steps on an existing run.
 * Durable orchestration (retries, pause/resume) layers on top later.
 */
export async function recordWorkflowPlan(
  db: DB,
  params: { runId: string; steps: WorkflowStepSpec[] },
): Promise<void> {
  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, params.runId))
    .limit(1);

  if (!run) throw new Error(`run not found: ${params.runId}`);

  const [agg] = await db
    .select({ m: max(runSteps.stepIndex) })
    .from(runSteps)
    .where(eq(runSteps.runId, params.runId));

  let idx =
    agg?.m !== null && agg?.m !== undefined ? Number(agg.m) + 1 : run.currentStep;

  for (const step of params.steps) {
    const idem =
      step.idempotencyKey ??
      `${params.runId}:${idx}:${step.kind}:${step.label}`.slice(0, 400);
    await db.insert(runSteps).values({
      runId: params.runId,
      stepIndex: idx++,
      type: step.kind,
      status: "pending",
      toolName: step.toolName ?? null,
      toolInput: (step.toolInput ?? null) as object | null,
      maxAttempts: step.maxAttempts ?? 3,
      idempotencyKey: idem,
    });
  }

  await db
    .update(runs)
    .set({ currentStep: idx, plan: params.steps as unknown as object })
    .where(eq(runs.id, params.runId));
}
