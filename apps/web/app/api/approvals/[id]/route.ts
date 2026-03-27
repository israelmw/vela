import { rejectApproval, resumeApprovedToolCall } from "@vela/agent-runtime";
import { db } from "@vela/db";
import { approvals } from "@vela/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    action?: "approve" | "reject";
    by?: string;
    reason?: string;
  };

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  }

  const [appr] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, id))
    .limit(1);

  if (!appr) {
    return NextResponse.json({ error: "approval not found" }, { status: 404 });
  }

  if (appr.status !== "pending") {
    return NextResponse.json(
      { error: "approval not pending" },
      { status: 409 },
    );
  }

  const by = typeof body.by === "string" ? body.by : "dashboard";

  if (action === "reject") {
    const r = await rejectApproval(db, {
      approvalId: id,
      actor: by,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const result = await resumeApprovedToolCall(db, {
    approvalId: id,
    resolvedBy: by,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if ("quorumPending" in result && result.quorumPending) {
    return NextResponse.json({
      ok: true,
      quorumPending: true,
      approveCount: result.approveCount,
      quorumRequired: result.quorumRequired,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
