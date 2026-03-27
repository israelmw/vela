import { eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import {
  mcpDiscoveredTools,
  mcpRegistry,
  toolsRegistry,
} from "@vela/db";
import type { InferSelectModel } from "drizzle-orm";
import type { ToolCallResult } from "./types";

const emptySchema = {
  type: "object",
  properties: {},
} as const;

function slugToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120);
}

export function mcpToolRegistryId(mcpId: string, toolName: string): string {
  return `mcp:${mcpId}:${slugToolName(toolName)}`;
}

function authHeaders(server: {
  authType: string;
  secretRef: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Accept: "application/json",
  };
  if (server.secretRef) {
    const token = process.env[server.secretRef];
    if (token) {
      if (server.authType === "bearer" || server.authType === "api_key") {
        headers.Authorization = `Bearer ${token}`;
      } else {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return headers;
}

async function jsonRpc(
  url: string,
  headers: Record<string, string>,
  method: string,
  params: unknown,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, error: `invalid json from MCP: ${text.slice(0, 200)}` };
    }
    const obj = data as { error?: { message?: string }; result?: unknown };
    if (obj.error) {
      return { ok: false, error: obj.error.message ?? "mcp error" };
    }
    return { ok: true, result: obj.result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function discoverMcpTools(
  db: DB,
  mcpId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const [server] = await db
    .select()
    .from(mcpRegistry)
    .where(eq(mcpRegistry.id, mcpId))
    .limit(1);

  if (!server) {
    return { ok: false, error: "MCP server not found" };
  }

  const headers = authHeaders(server);
  const rpc = await jsonRpc(server.url, headers, "tools/list", {});
  const now = new Date();

  if (!rpc.ok) {
    await db
      .update(mcpRegistry)
      .set({ lastHealthCheck: now, lastHealthOk: false })
      .where(eq(mcpRegistry.id, mcpId));
    return { ok: false, error: rpc.error };
  }

  const result = rpc.result as {
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: unknown;
    }>;
  };
  const tools = result.tools ?? [];

  await db
    .update(mcpRegistry)
    .set({ lastHealthCheck: now, lastHealthOk: true })
    .where(eq(mcpRegistry.id, mcpId));

  let count = 0;
  for (const t of tools) {
    if (!t?.name) continue;
    await db
      .insert(mcpDiscoveredTools)
      .values({
        mcpId,
        toolName: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? emptySchema) as object,
      })
      .onConflictDoUpdate({
        target: [mcpDiscoveredTools.mcpId, mcpDiscoveredTools.toolName],
        set: {
          description: t.description ?? "",
          inputSchema: (t.inputSchema ?? emptySchema) as object,
          discoveredAt: now,
        },
      });
    count++;
  }

  return { ok: true, count };
}

export async function syncMcpToolsToRegistry(db: DB, mcpId: string) {
  const discovered = await db
    .select()
    .from(mcpDiscoveredTools)
    .where(eq(mcpDiscoveredTools.mcpId, mcpId));

  for (const row of discovered) {
    const id = mcpToolRegistryId(mcpId, row.toolName);
    await db
      .insert(toolsRegistry)
      .values({
        id,
        name: row.toolName,
        description: row.description || `MCP tool (${mcpId})`,
        inputSchema: row.inputSchema as object,
        executorType: "mcp",
        executorRef: `${mcpId}::${row.toolName}`,
        requiresApproval: false,
        scope: "mcp:dynamic",
        requiredSecretProvider: null,
      })
      .onConflictDoUpdate({
        target: toolsRegistry.id,
        set: {
          description: row.description || `MCP tool (${mcpId})`,
          inputSchema: row.inputSchema as object,
          executorRef: `${mcpId}::${row.toolName}`,
        },
      });
  }
}

function mcpCatalogNeedsRefresh(server: {
  lastHealthCheck: Date | null;
  lastHealthOk: boolean | null;
}): boolean {
  const ttl = Number(process.env.VELA_MCP_HEALTH_REFRESH_MS ?? "120000");
  if (server.lastHealthOk === false) return true;
  if (server.lastHealthCheck == null) return true;
  return Date.now() - server.lastHealthCheck.getTime() > ttl;
}

/**
 * If the server looks stale or unhealthy, re-run tools/list and sync tools_registry.
 * Called on the MCP tool execution path so discovery is driven by real traffic + health,
 * not only ingest/cron throttles.
 */
export async function maybeRefreshMcpCatalog(
  db: DB,
  mcpId: string,
  server?: { lastHealthCheck: Date | null; lastHealthOk: boolean | null },
): Promise<void> {
  const row =
    server ??
    (await db
      .select({
        lastHealthCheck: mcpRegistry.lastHealthCheck,
        lastHealthOk: mcpRegistry.lastHealthOk,
      })
      .from(mcpRegistry)
      .where(eq(mcpRegistry.id, mcpId))
      .limit(1))[0];
  if (!row || !mcpCatalogNeedsRefresh(row)) return;
  const d = await discoverMcpTools(db, mcpId);
  if (d.ok) await syncMcpToolsToRegistry(db, mcpId);
}

export async function callMcpTool(
  db: DB,
  tool: InferSelectModel<typeof toolsRegistry>,
  params: {
    tenantId: string;
    agentId: string;
    args: unknown;
  },
): Promise<ToolCallResult> {
  void params.tenantId;
  void params.agentId;
  const ref = tool.executorRef;
  const idx = ref.indexOf("::");
  if (idx <= 0 || idx === ref.length - 2) {
    return {
      ok: false,
      error: "Invalid MCP executorRef (expected mcpId::toolName)",
      code: "unknown_tool",
    };
  }
  const mcpId = ref.slice(0, idx);
  const toolName = ref.slice(idx + 2);

  const [server] = await db
    .select()
    .from(mcpRegistry)
    .where(eq(mcpRegistry.id, mcpId))
    .limit(1);

  if (!server) {
    return {
      ok: false,
      error: `MCP server not registered: ${mcpId}`,
      code: "unknown_tool",
    };
  }

  await maybeRefreshMcpCatalog(db, mcpId, server);

  const headers = authHeaders(server);
  let rpc = await jsonRpc(server.url, headers, "tools/call", {
    name: toolName,
    arguments: params.args ?? {},
  });

  if (!rpc.ok) {
    const healed = await discoverMcpTools(db, mcpId);
    if (healed.ok) await syncMcpToolsToRegistry(db, mcpId);
    rpc = await jsonRpc(server.url, headers, "tools/call", {
      name: toolName,
      arguments: params.args ?? {},
    });
  }

  if (!rpc.ok) {
    return { ok: false, error: rpc.error, code: "denied" };
  }

  return { ok: true, output: rpc.result };
}
