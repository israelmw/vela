import { and, eq } from "drizzle-orm";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import {
  mcpDiscoveredTools,
  mcpRegistry,
  toolBindings,
} from "@vela/db";
import {
  discoverMcpTools,
  mcpToolRegistryId,
  syncMcpToolsToRegistry,
} from "@vela/tool-router";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  await ensureDefaultAgent(db, tenantId);

  const servers = await db.select().from(mcpRegistry);
  const discovered = await db.select().from(mcpDiscoveredTools);

  return NextResponse.json({ servers, discovered });
}

async function ensureBindingsForMcp(
  mcpId: string,
  tenantId: string,
  agentId: string,
) {
  const rows = await db
    .select()
    .from(mcpDiscoveredTools)
    .where(eq(mcpDiscoveredTools.mcpId, mcpId));

  for (const r of rows) {
    const toolId = mcpToolRegistryId(mcpId, r.toolName);
    const [existing] = await db
      .select()
      .from(toolBindings)
      .where(
        and(
          eq(toolBindings.agentId, agentId),
          eq(toolBindings.tenantId, tenantId),
          eq(toolBindings.toolId, toolId),
        ),
      )
      .limit(1);
    if (!existing) {
      await db.insert(toolBindings).values({
        agentId,
        tenantId,
        toolId,
        enabled: true,
      });
    }
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    mcpId?: string;
  };

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const mcpId = body.mcpId?.trim();

  if (!mcpId) {
    return NextResponse.json({ error: "mcpId required" }, { status: 400 });
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
