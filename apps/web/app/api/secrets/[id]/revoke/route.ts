import { revokeSecretBinding } from "@vela/policy-engine";
import { db } from "@vela/db";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    tenantId?: string;
    reason?: string;
  };

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const result = await revokeSecretBinding(db, {
    id,
    tenantId,
    ...(typeof body.reason === "string" && body.reason.trim()
      ? { reason: body.reason.trim() }
      : {}),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
