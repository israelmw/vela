import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { DB } from "@vela/db";
import { toolBindings, toolsRegistry } from "@vela/db";
import { canUseTool, findActiveSecretBinding } from "@vela/policy-engine";
import { dispatchBuiltin } from "./builtin-dispatch";
import { callMcpTool } from "./mcp";
import type { ToolCallResult } from "./types";
export type { ToolCallResult } from "./types";
export { dispatchBuiltin } from "./builtin-dispatch";
export { toolsRegistry } from "@vela/db";
export { canUseTool } from "@vela/policy-engine";
export { discoverMcpTools, mcpToolRegistryId, syncMcpToolsToRegistry } from "./mcp";

/**
 * Dispatch tool execution after policy checks (builtin vs MCP).
 */
export async function executeToolDispatch(
  db: DB,
  params: {
    agentId: string;
    tenantId: string;
    sessionId: string;
    toolId: string;
    args: unknown;
  },
): Promise<ToolCallResult> {
  void params.sessionId;

  const [tool] = await db
    .select()
    .from(toolsRegistry)
    .where(eq(toolsRegistry.id, params.toolId))
    .limit(1);

  if (!tool) {
    return {
      ok: false,
      error: "Tool not registered",
      code: "unknown_tool",
    };
  }

  if (tool.requiredSecretProvider) {
    const secret = await findActiveSecretBinding(db, {
      tenantId: params.tenantId,
      agentId: params.agentId,
      provider: tool.requiredSecretProvider,
    });
    if (!secret) {
      return {
        ok: false,
        error: `Missing active secret for provider: ${tool.requiredSecretProvider}`,
        code: "denied",
      };
    }
  }

  if (tool.executorType === "mcp") {
    return callMcpTool(db, tool as InferSelectModel<typeof toolsRegistry>, {
      tenantId: params.tenantId,
      agentId: params.agentId,
      args: params.args,
    });
  }

  return dispatchBuiltin(params.toolId, params.args);
}

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

  return executeToolDispatch(db, params);
}

/** After human approval — binding must still exist. */
export async function executeApprovedBuiltinTool(
  db: DB,
  params: {
    agentId: string;
    tenantId: string;
    toolId: string;
    args: unknown;
    sessionId?: string;
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

  return executeToolDispatch(db, {
    agentId: params.agentId,
    tenantId: params.tenantId,
    sessionId: params.sessionId ?? "approval-resume",
    toolId: params.toolId,
    args: params.args,
  });
}
