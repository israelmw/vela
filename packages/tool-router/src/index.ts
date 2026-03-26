import { and, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { toolBindings } from "@vela/db";
import { canUseTool } from "@vela/policy-engine";
import { dispatchBuiltin } from "./builtin-dispatch";
import type { ToolCallResult } from "./types";
export type { ToolCallResult } from "./types";
export { dispatchBuiltin } from "./builtin-dispatch";
export { toolsRegistry } from "@vela/db";
export { canUseTool } from "@vela/policy-engine";

/**
 * Execute a builtin tool after policy check (Phase 2+).
 * Tools requiring approval return requires_approval without executing.
 */
export async function executeBuiltinTool(
  db: DB,
  params: {
    agentId: string;
    tenantId: string;
    sessionId: string;
    toolId: string;
    args: unknown;
  },
): Promise<ToolCallResult> {
  const policy = await canUseTool(db, {
    agentId: params.agentId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    toolId: params.toolId,
  });

  if (!policy.allowed) {
    return {
      ok: false,
      error: policy.reason ?? "Policy denied",
      code: "denied",
    };
  }

  if (policy.requires_approval) {
    return {
      ok: false,
      error: "Tool call requires approval before execution",
      code: "requires_approval",
    };
  }

  return dispatchBuiltin(params.toolId, params.args);
}

/** After human approval — binding must still exist. */
export async function executeApprovedBuiltinTool(
  db: DB,
  params: {
    agentId: string;
    tenantId: string;
    toolId: string;
    args: unknown;
  },
): Promise<ToolCallResult> {
  const [binding] = await db
    .select()
    .from(toolBindings)
    .where(
      and(
        eq(toolBindings.agentId, params.agentId),
        eq(toolBindings.tenantId, params.tenantId),
        eq(toolBindings.toolId, params.toolId),
        eq(toolBindings.enabled, true),
      ),
    )
    .limit(1);

  if (!binding) {
    return {
      ok: false,
      error: "Tool not bound for this agent/tenant",
      code: "denied",
    };
  }

  return dispatchBuiltin(params.toolId, params.args);
}
