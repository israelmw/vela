import { expireStaleApprovals } from "@vela/agent-runtime";
import { db, approvals } from "@vela/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  await expireStaleApprovals(db);
  const rows = await db
    .select({
      id: approvals.id,
      type: approvals.type,
      status: approvals.status,
      requestedAt: approvals.requestedAt,
      payload: approvals.payload,
    })
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .orderBy(desc(approvals.requestedAt))
    .limit(50);

  return NextResponse.json({
    approvals: rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      description:
        (typeof r.payload === "object" &&
          r.payload &&
          "reason" in r.payload &&
          typeof (r.payload as Record<string, unknown>).reason === "string" &&
          (r.payload as Record<string, unknown>).reason) ||
        `${r.type} request`,
    })),
  });
}
