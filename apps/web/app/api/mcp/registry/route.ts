import { ensureDefaultAgent } from "@vela/control-plane";
import { db, mcpRegistry } from "@vela/db";
import { discoverMcpTools, syncMcpToolsToRegistry } from "@vela/tool-router";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { ensureBindingsForMcp } from "../../../../lib/mcp-autosync";

/**
 * Upsert mcp_registry and immediately discover + sync tools (event-driven path).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    id?: string;
    name?: string;
    url?: string;
    authType?: string;
    secretRef?: string | null;
    capabilityTags?: string[];
    requiredScopes?: string[];
  };

  const id = body.id?.trim();
  const name = body.name?.trim();
  const url = body.url?.trim();
  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;

  if (!id || !name || !url) {
    return NextResponse.json(
      { error: "id, name, and url are required" },
      { status: 400 },
    );
  }

  const authType = body.authType?.trim() || "bearer";
  const secretRef =
    body.secretRef === undefined ? null : body.secretRef?.trim() || null;
  const capabilityTags = Array.isArray(body.capabilityTags)
    ? body.capabilityTags.filter((x): x is string => typeof x === "string")
    : [];
  const requiredScopes = Array.isArray(body.requiredScopes)
    ? body.requiredScopes.filter((x): x is string => typeof x === "string")
    : [];

  await db
    .insert(mcpRegistry)
    .values({
      id,
      name,
      url,
      authType,
      secretRef,
      capabilityTags,
      requiredScopes,
    })
    .onConflictDoUpdate({
      target: mcpRegistry.id,
      set: {
        name,
        url,
        authType,
        secretRef,
        capabilityTags,
        requiredScopes,
      },
    });

  const agent = await ensureDefaultAgent(db, tenantId);
  const discovered = await discoverMcpTools(db, id);

  if (!discovered.ok) {
    return NextResponse.json(
      { ok: false, error: discovered.error, mcpId: id },
      { status: 502 },
    );
  }

  await syncMcpToolsToRegistry(db, id);
  await ensureBindingsForMcp(id, tenantId, agent.id);

  return NextResponse.json({
    ok: true,
    mcpId: id,
    discoveredCount: discovered.count,
  });
}
