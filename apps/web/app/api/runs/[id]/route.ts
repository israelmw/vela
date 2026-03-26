import { db } from "@vela/db";
import { approvals, runSteps, runs } from "@vela/db";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);

  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const steps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, id))
    .orderBy(asc(runSteps.stepIndex));

  const appr = await db
    .select()
    .from(approvals)
    .where(eq(approvals.runId, id));

  return NextResponse.json({ run, steps, approvals: appr });
}
