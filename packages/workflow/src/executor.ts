import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, isNull, lte, ne, notInArray, or } from "drizzle-orm";
import type { DB } from "@vela/db";
import { approvals, runSteps, runs } from "@vela/db";
import { computeRetryDelayMs } from "./backoff";

export type RunStepRow = InferSelectModel<typeof runSteps>;

export type StepDriverResult =
  | { kind: "success"; output?: unknown }
  | { kind: "retry"; error: string }
  | { kind: "fail"; error: string }
  | {
      kind: "approval";
      toolId: string;
      args: unknown;
      approvalType?:
        | "tool_call"
        | "external_action"
        | "secret_use"
        | "subagent_spawn"
        | "policy_override";
      quorumRequired?: number;
      expiresAt?: Date | null;
    };

/**
 * Runs the next due workflow step (pending, or retrying when nextRetryAt has passed).
 * Idempotency: each row is a single logical step; retries mutate `attempt` in place.
 */
export async function runNextPendingWorkflowStep(
  db: DB,
  params: {
    runId: string;
    agentId: string;
    tenantId: string;
    sessionId: string;
    executor: (step: RunStepRow) => Promise<StepDriverResult>;
    now?: Date;
  },
): Promise<
  | { status: "done" }
  | { status: "advanced" }
  | { status: "halt"; reason: "approval" | "fatal"; message?: string }
> {
  const now = params.now ?? new Date();

  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, params.runId))
    .limit(1);

  if (!run) {
    return { status: "halt", reason: "fatal", message: "run not found" };
  }

  const [pendingApproval] = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(
      and(eq(approvals.runId, params.runId), eq(approvals.status, "pending")),
    )
    .limit(1);

  if (pendingApproval) {
    return { status: "done" };
  }

  const [next] = await db
    .select()
    .from(runSteps)
    .where(
      and(
        eq(runSteps.runId, params.runId),
        or(
          eq(runSteps.status, "pending"),
          and(
            eq(runSteps.status, "retrying"),
            or(isNull(runSteps.nextRetryAt), lte(runSteps.nextRetryAt, now)),
          ),
        ),
      ),
    )
    .orderBy(asc(runSteps.stepIndex))
    .limit(1);

  if (!next) {
    const open = await db
      .select({ id: runSteps.id })
      .from(runSteps)
      .where(
        and(
          eq(runSteps.runId, params.runId),
          notInArray(runSteps.status, ["completed", "skipped", "failed"]),
        ),
      )
      .limit(1);

    if (!open.length) {
      const [failed] = await db
        .select({ id: runSteps.id })
        .from(runSteps)
        .where(
          and(eq(runSteps.runId, params.runId), eq(runSteps.status, "failed")),
        )
        .limit(1);

      if (!failed) {
        await db
          .update(runs)
          .set({ status: "completed", endedAt: new Date() })
          .where(
            and(
              eq(runs.id, params.runId),
              ne(runs.status, "awaiting_approval"),
            ),
          );
      }
    }

    return { status: "done" };
  }

  await db
    .update(runSteps)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(runSteps.id, next.id));

  await db
    .update(runs)
    .set({ status: "running", requiresApproval: false })
    .where(eq(runs.id, params.runId));

  const result = await params.executor(next);

  if (result.kind === "success") {
    await db
      .update(runSteps)
      .set({
        status: "completed",
        toolResult: (result.output ?? null) as object | null,
        endedAt: new Date(),
        nextRetryAt: null,
        lastError: null,
      })
      .where(eq(runSteps.id, next.id));
    return { status: "advanced" };
  }

  if (result.kind === "approval") {
    await db
      .update(runSteps)
      .set({
        status: "pending",
        lastError: "awaiting human approval",
      })
      .where(eq(runSteps.id, next.id));

    await db.insert(approvals).values({
      runId: params.runId,
      runStepId: next.id,
      type: result.approvalType ?? "tool_call",
      payload: { toolId: result.toolId, args: result.args },
      status: "pending",
      quorumRequired: result.quorumRequired ?? 1,
      expiresAt: result.expiresAt ?? null,
    });

    await db
      .update(runs)
      .set({ status: "awaiting_approval", requiresApproval: true })
      .where(eq(runs.id, params.runId));

    return { status: "halt", reason: "approval" };
  }

  if (result.kind === "retry") {
    const attempt = next.attempt + 1;
    if (attempt >= next.maxAttempts) {
      await db
        .update(runSteps)
        .set({
          status: "failed",
          attempt,
          lastError: result.error,
          endedAt: new Date(),
        })
        .where(eq(runSteps.id, next.id));
      await db
        .update(runs)
        .set({ status: "failed", error: result.error, endedAt: new Date() })
        .where(eq(runs.id, params.runId));
      return {
        status: "halt",
        reason: "fatal",
        message: result.error,
      };
    }
    const delay = computeRetryDelayMs(attempt - 1);
    const nextAt = new Date(now.getTime() + delay);
    await db
      .update(runSteps)
      .set({
        status: "retrying",
        attempt,
        lastError: result.error,
        nextRetryAt: nextAt,
      })
      .where(eq(runSteps.id, next.id));
    return { status: "advanced" };
  }

  await db
    .update(runSteps)
    .set({
      status: "failed",
      lastError: result.error,
      endedAt: new Date(),
    })
    .where(eq(runSteps.id, next.id));
  await db
    .update(runs)
    .set({ status: "failed", error: result.error, endedAt: new Date() })
    .where(eq(runs.id, params.runId));
  return { status: "halt", reason: "fatal", message: result.error };
}

export async function drainWorkflowSteps(
  db: DB,
  params: {
    runId: string;
    agentId: string;
    tenantId: string;
    sessionId: string;
    executor: (step: RunStepRow) => Promise<StepDriverResult>;
    maxSteps?: number;
    now?: Date;
  },
): Promise<{
  processed: number;
  done: boolean;
  halt?: "approval" | "fatal";
  message?: string;
}> {
  const max = params.maxSteps ?? 25;
  let processed = 0;
  for (let i = 0; i < max; i++) {
    const r = await runNextPendingWorkflowStep(db, {
      runId: params.runId,
      agentId: params.agentId,
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      executor: params.executor,
      ...(params.now !== undefined ? { now: params.now } : {}),
    });
    if (r.status === "done") {
      return { processed, done: true };
    }
    if (r.status === "halt") {
      const out: {
        processed: number;
        done: false;
        halt: "approval" | "fatal";
        message?: string;
      } = { processed, done: false, halt: r.reason };
      if (r.message !== undefined) {
        out.message = r.message;
      }
      return out;
    }
    processed++;
  }
  return {
    processed,
    done: false,
    halt: "fatal",
    message: "maxSteps exceeded",
  };
}
