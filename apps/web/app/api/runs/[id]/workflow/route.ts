import { db } from "@vela/db";
import { getRunById } from "@vela/control-plane";
import { sessions } from "@vela/db";
import { eq } from "drizzle-orm";
import {
  createBuiltinWorkflowStepExecutor,
  drainWorkflowSteps,
} from "@vela/workflow";
import { NextResponse } from "next/server";
import { log } from "../../../../../lib/logger";

/** Resume durable workflow execution (e.g. after retry delay or manual poke). */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
  const run = await getRunById(db, runId);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, run.sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const executor = createBuiltinWorkflowStepExecutor({
    db,
    agentId: run.agentId,
    tenantId: session.tenantId,
    sessionId: run.sessionId,
    runId: run.id,
  });

  const drain = await drainWorkflowSteps(db, {
    runId: run.id,
    agentId: run.agentId,
    tenantId: session.tenantId,
    sessionId: run.sessionId,
    executor,
    maxSteps: 40,
  });

  log.info("api.runs.workflow", {
    runId: run.id,
    processed: drain.processed,
    done: drain.done,
    halt: drain.halt,
  });

  return NextResponse.json({
    processed: drain.processed,
    done: drain.done,
    halt: drain.halt ?? null,
    message: drain.message ?? null,
  });
}
