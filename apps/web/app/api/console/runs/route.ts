import { listRecentRuns } from "@vela/control-plane";
import { db, runSteps } from "@vela/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await listRecentRuns(db, 20);
  const out = await Promise.all(
    rows.map(async (run) => {
      const steps = await db
        .select({
          type: runSteps.type,
          tool: runSteps.toolName,
          status: runSteps.status,
          startedAt: runSteps.startedAt,
          endedAt: runSteps.endedAt,
        })
        .from(runSteps)
        .where(eq(runSteps.runId, run.id))
        .orderBy(desc(runSteps.stepIndex))
        .limit(4);

      return {
        id: run.id,
        status: run.status,
        trigger: run.trigger,
        startedAt: run.startedAt.toISOString(),
        steps: steps.map((s) => ({
          type: s.type,
          tool: s.tool ?? s.type,
          status:
            s.status === "failed"
              ? "err"
              : s.status === "retrying"
                ? "warn"
                : "ok",
          duration: s.endedAt
            ? `${Math.max(1, s.endedAt.getTime() - s.startedAt.getTime())}ms`
            : "running",
        })),
      };
    }),
  );
  return NextResponse.json({ runs: out });
}
