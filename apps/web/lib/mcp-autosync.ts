import { and, eq } from "drizzle-orm";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db, mcpDiscoveredTools, mcpRegistry, toolBindings } from "@vela/db";
import {
  discoverMcpTools,
  mcpToolRegistryId,
  syncMcpToolsToRegistry,
} from "@vela/tool-router";

const DEFAULT_INTERVAL_MS = Number(
  process.env.VELA_MCP_AUTOSYNC_MS ?? "300000",
);

let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

export type McpSyncServerResult =
  | { mcpId: string; ok: true; count: number }
  | { mcpId: string; ok: false; error: string };

export type McpSyncAllResult = {
  ok: boolean;
  results: McpSyncServerResult[];
};

export async function ensureBindingsForMcp(
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

/**
 * Discovery + tools_registry sync + default agent bindings for every MCP row.
 * Does not use ingest throttle; use for cron, admin actions, or API `syncAll`.
 */
export async function syncAllMcpServersForTenant(
  tenantId: string,
): Promise<McpSyncAllResult> {
  const agent = await ensureDefaultAgent(db, tenantId);
  const servers = await db.select().from(mcpRegistry);
  const results: McpSyncServerResult[] = [];

  for (const s of servers) {
    const discovered = await discoverMcpTools(db, s.id);
    if (!discovered.ok) {
      results.push({ mcpId: s.id, ok: false, error: discovered.error });
      continue;
    }
    await syncMcpToolsToRegistry(db, s.id);
    await ensureBindingsForMcp(s.id, tenantId, agent.id);
    results.push({ mcpId: s.id, ok: true, count: discovered.count });
  }

  return {
    ok: results.length === 0 || results.every((r) => r.ok),
    results,
  };
}

export async function maybeAutoSyncMcpTools(
  tenantId: string,
): Promise<void> {
  const now = Date.now();
  if (now - lastSyncAt < DEFAULT_INTERVAL_MS) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    await syncAllMcpServersForTenant(tenantId);
    lastSyncAt = Date.now();
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
