import {
  createSecretBinding,
  listSecretBindings,
} from "@vela/policy-engine";
import { db } from "@vela/db";
import { ensureDefaultAgent } from "@vela/control-plane";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const agent = await ensureDefaultAgent(db, tenantId);
  const rows = await listSecretBindings(db, {
    tenantId,
    agentId: agent.id,
  });
  return NextResponse.json({ secrets: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    agentId?: string | null;
    provider?: string;
    scope?: string;
    secretRef?: string;
    expiresAt?: string | null;
  };

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const provider = body.provider?.trim();
  const scope = body.scope?.trim();
  const secretRef = body.secretRef?.trim();

  if (!provider || !scope || !secretRef) {
    return NextResponse.json(
      { error: "provider, scope, secretRef required" },
      { status: 400 },
    );
  }

  const agent =
    body.agentId !== undefined && body.agentId !== null
      ? { id: body.agentId }
      : await ensureDefaultAgent(db, tenantId);

  const expiresAt =
    body.expiresAt && body.expiresAt.length > 0
      ? new Date(body.expiresAt)
      : null;

  const row = await createSecretBinding(db, {
    tenantId,
    agentId: agent.id,
    provider,
    scope,
    secretRef,
    expiresAt,
  });

  return NextResponse.json({ secret: row });
}
