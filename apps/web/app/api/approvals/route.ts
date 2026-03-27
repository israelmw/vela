import { expireStaleApprovals } from "@vela/agent-runtime";
import { db } from "@vela/db";
import { approvals } from "@vela/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  await expireStaleApprovals(db);
  const rows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .orderBy(desc(approvals.requestedAt));

  return NextResponse.json({ approvals: rows });
}
