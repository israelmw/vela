import { eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { runs } from "@vela/db";
import { createRun } from "@vela/control-plane";
import { MAX_SUBAGENT_DEPTH } from "@vela/types";

export async function runChildSubagentRun(
  db: DB,
  parent: {
    id: string;
    sessionId: string;
    agentId: string;
    subagentDepth: number;
  },
  goal: string,
  runTurn: (db: DB, runId: string) => Promise<void>,
): Promise<{ childRunId: string; summary: string }> {
  if (parent.subagentDepth >= MAX_SUBAGENT_DEPTH) {
    throw new Error("subagent max depth exceeded");
  }

  const child = await createRun(db, {
    sessionId: parent.sessionId,
    agentId: parent.agentId,
    trigger: "subagent",
    parentRunId: parent.id,
    subagentDepth: parent.subagentDepth + 1,
    plan: { subagentGoal: goal },
  });

  await runTurn(db, child.id);

  const [finished] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, child.id))
    .limit(1);

  const summary =
    finished?.resultSummary ?? finished?.error ?? "subagent completed";
  return { childRunId: child.id, summary };
}
