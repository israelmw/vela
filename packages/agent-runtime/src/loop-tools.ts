import { dynamicTool, jsonSchema } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@vela/db";
import { toolBindings, toolsRegistry } from "@vela/db";
import { executeBuiltinTool } from "@vela/tool-router";

/** AI SDK tool names: alphanumeric + underscore (registry ids use dots). */
export function toolNameFromRegistryId(registryId: string): string {
  return registryId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const looseObjectSchema = jsonSchema({
  type: "object",
  additionalProperties: true,
});

/**
 * Bound tools for this agent/tenant as an AI SDK toolset (native multi-step loop).
 * Skips `requiresApproval` tools — those stay on approval / workflow paths only.
 */
export async function buildAgentToolset(
  db: DB,
  ctx: {
    agentId: string;
    tenantId: string;
    sessionId: string;
    runId: string;
  },
): Promise<Record<string, ReturnType<typeof dynamicTool>>> {
  const bindings = await db
    .select({ toolId: toolBindings.toolId })
    .from(toolBindings)
    .where(
      and(
        eq(toolBindings.agentId, ctx.agentId),
        eq(toolBindings.tenantId, ctx.tenantId),
        eq(toolBindings.enabled, true),
      ),
    );

  const ids = [...new Set(bindings.map((b) => b.toolId))];
  if (ids.length === 0) return {};

  const rows = await db
    .select({
      id: toolsRegistry.id,
      description: toolsRegistry.description,
      requiresApproval: toolsRegistry.requiresApproval,
    })
    .from(toolsRegistry)
    .where(inArray(toolsRegistry.id, ids));

  const tools: Record<string, ReturnType<typeof dynamicTool>> = {};

  for (const row of rows) {
    if (row.requiresApproval) continue;

    const name = toolNameFromRegistryId(row.id);
    const description = row.description?.trim() || row.id;
    const toolId = row.id;

    tools[name] = dynamicTool({
      description: `${description} (registry id: ${toolId})`,
      inputSchema: looseObjectSchema,
      execute: async (input: unknown) => {
        const r = await executeBuiltinTool(db, {
          agentId: ctx.agentId,
          tenantId: ctx.tenantId,
          sessionId: ctx.sessionId,
          runId: ctx.runId,
          toolId,
          args: input,
        });
        if (!r.ok) {
          throw new Error(r.error);
        }
        return r.output;
      },
    });
  }

  return tools;
}
