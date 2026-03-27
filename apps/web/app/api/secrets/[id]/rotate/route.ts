import { rotateSecretBinding } from "@vela/policy-engine";
import { db } from "@vela/db";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as {
    newSecretRef?: string;
    tenantId?: string;
    expiresAt?: string | null;
  };

  const newSecretRef = body.newSecretRef?.trim();
  if (!newSecretRef) {
    return NextResponse.json({ error: "newSecretRef required" }, { status: 400 });
  }

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const newExpiresAt =
    body.expiresAt && body.expiresAt.length > 0
      ? new Date(body.expiresAt)
      : null;

  const result = await rotateSecretBinding(db, {
    id,
    tenantId,
    newSecretRef,
    newExpiresAt,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ secret: result.successor });
}
