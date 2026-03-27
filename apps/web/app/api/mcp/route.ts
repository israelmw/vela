import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import { mcpDiscoveredTools, mcpRegistry } from "@vela/db";
import { discoverMcpTools, syncMcpToolsToRegistry } from "@vela/tool-router";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";
import {
  ensureBindingsForMcp,
  syncAllMcpServersForTenant,
} from "../../../lib/mcp-autosync";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  await ensureDefaultAgent(db, tenantId);

  const servers = await db.select().from(mcpRegistry);
  const discovered = await db.select().from(mcpDiscoveredTools);

  return NextResponse.json({ servers, discovered });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    mcpId?: string;
    syncAll?: boolean;
  };

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;

  if (body.syncAll === true) {
    const out = await syncAllMcpServersForTenant(tenantId);
    return NextResponse.json(out);
  }

  const mcpId = body.mcpId?.trim();

  if (!mcpId) {
    return NextResponse.json(
      { error: "mcpId required (or set syncAll: true)" },
      { status: 400 },
    );
  }

  const agent = await ensureDefaultAgent(db, tenantId);
  const discovered = await discoverMcpTools(db, mcpId);

  if (!discovered.ok) {
    return NextResponse.json({ error: discovered.error }, { status: 400 });
  }

  await syncMcpToolsToRegistry(db, mcpId);
  await ensureBindingsForMcp(mcpId, tenantId, agent.id);

  return NextResponse.json({
    ok: true,
    discoveredCount: discovered.count,
  });
}
