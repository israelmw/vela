import { and, asc, count, desc, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import {
  agents,
  messages,
  runEvents,
  runs,
  sessions,
  threads,
} from "@vela/db";
import type { ChannelType } from "@vela/types";
import { DEFAULT_TENANT_ID } from "@vela/types";

export { DEFAULT_TENANT_ID };

export async function ensureDefaultAgent(
  db: DB,
  tenantId: string = DEFAULT_TENANT_ID,
) {
  const [existing] = await db
    .select()
    .from(agents)
    .where(eq(agents.tenantId, tenantId))
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(agents)
    .values({
      name: "default",
      description: "Default agent (scaffold)",
      model: "anthropic/claude-sonnet-4.6",
      systemPrompt:
        "You are Vela, a concise assistant for the control plane. Be brief.",
      tenantId,
      defaultSkills: [],
      allowedChannels: ["web", "slack"],
    })
    .returning();

  return row!;
}

export async function getOrCreateThread(
  db: DB,
  input: {
    tenantId: string;
    agentId: string;
    channel: ChannelType;
    channelRef: string;
  },
) {
  const [existing] = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.tenantId, input.tenantId),
        eq(threads.agentId, input.agentId),
        eq(threads.channel, input.channel),
        eq(threads.channelRef, input.channelRef),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(threads)
    .values({
      tenantId: input.tenantId,
      agentId: input.agentId,
      channel: input.channel,
      channelRef: input.channelRef,
    })
    .returning();

  return row!;
}

export async function getOrCreateActiveSession(
  db: DB,
  input: {
    threadId: string;
    agentId: string;
    tenantId: string;
  },
) {
  const [existing] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.threadId, input.threadId),
        eq(sessions.status, "active"),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(sessions)
    .values({
      threadId: input.threadId,
      agentId: input.agentId,
      tenantId: input.tenantId,
      status: "active",
    })
    .returning();

  return row!;
}

export async function appendMessage(
  db: DB,
  input: {
    sessionId: string;
    threadId: string;
    role: "user" | "assistant" | "tool" | "system";
    content: unknown;
    toolCallId?: string | null;
  },
) {
  const [row] = await db
    .insert(messages)
    .values({
      sessionId: input.sessionId,
      threadId: input.threadId,
      role: input.role,
      content: input.content as Record<string, unknown>,
      toolCallId: input.toolCallId ?? null,
    })
    .returning();

  return row!;
}

export async function createRun(
  db: DB,
  input: {
    sessionId: string;
    agentId: string;
    trigger: string;
    requiresApproval?: boolean;
    parentRunId?: string | null;
    subagentDepth?: number;
    plan?: unknown;
  },
) {
  const [row] = await db
    .insert(runs)
    .values({
      sessionId: input.sessionId,
      agentId: input.agentId,
      trigger: input.trigger,
      status: "pending",
      requiresApproval: input.requiresApproval ?? false,
      parentRunId: input.parentRunId ?? null,
      subagentDepth: input.subagentDepth ?? 0,
      plan: (input.plan ?? null) as object | null,
    })
    .returning();

  return row!;
}

export async function updateRunStatus(
  db: DB,
  runId: string,
  input: {
    status: "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
    resultSummary?: string | null;
    error?: string | null;
    endedAt?: Date | null;
  },
) {
  const patch: {
    status: (typeof input)["status"];
    resultSummary?: string | null;
    error?: string | null;
    endedAt?: Date | null;
  } = { status: input.status };

  if (input.resultSummary !== undefined) {
    patch.resultSummary = input.resultSummary;
  }
  if (input.error !== undefined) {
    patch.error = input.error;
  }
  if (input.endedAt !== undefined) {
    patch.endedAt = input.endedAt;
  }

  const [row] = await db
    .update(runs)
    .set(patch)
    .where(eq(runs.id, runId))
    .returning();

  return row;
}

/** Marks run complete with optional summary (Phase 1 convenience). */
export async function completeRun(
  db: DB,
  runId: string,
  resultSummary: string | null,
  error: string | null = null,
) {
  if (error) {
    return updateRunStatus(db, runId, {
      status: "failed",
      resultSummary,
      error,
      endedAt: new Date(),
    });
  }
  return updateRunStatus(db, runId, {
    status: "completed",
    resultSummary,
    error: null,
    endedAt: new Date(),
  });
}

export async function listRecentRuns(
  db: DB,
  limit: number = 10,
  status?: (typeof runs.$inferSelect)["status"],
) {
  if (status) {
    return db
      .select()
      .from(runs)
      .where(eq(runs.status, status))
      .orderBy(desc(runs.startedAt))
      .limit(limit);
  }
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
}

export async function appendRunEvent(
  db: DB,
  input: {
    runId: string;
    stepIndex?: number | null;
    level: string;
    eventType: string;
    message: string;
    meta?: unknown;
    requestId?: string | null;
  },
) {
  const [row] = await db
    .insert(runEvents)
    .values({
      runId: input.runId,
      stepIndex: input.stepIndex ?? null,
      level: input.level,
      eventType: input.eventType,
      message: input.message,
      meta: (input.meta ?? null) as object | null,
      requestId: input.requestId ?? null,
    })
    .returning();
  return row!;
}

export async function listRunEvents(db: DB, runId: string) {
  return db
    .select()
    .from(runEvents)
    .where(eq(runEvents.runId, runId))
    .orderBy(asc(runEvents.createdAt));
}

export async function getRunById(db: DB, runId: string) {
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return row ?? null;
}

export async function countRuns(db: DB) {
  const [row] = await db.select({ c: count() }).from(runs);
  return Number(row?.c ?? 0);
}
