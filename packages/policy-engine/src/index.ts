import { and, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { toolBindings, toolsRegistry } from "@vela/db";
import type { PolicyResult } from "@vela/types";
import { findActiveSecretBinding } from "./secrets";

export type { DB } from "@vela/db";
export {
  createSecretBinding,
  expireStaleSecretBindings,
  findActiveSecretBinding,
  listSecretBindings,
  revokeSecretBinding,
  rotateSecretBinding,
} from "./secrets";

export async function canUseTool(
  db: DB,
  params: {
    agentId: string;
    tenantId: string;
    sessionId: string;
    toolId: string;
  },
): Promise<PolicyResult> {
  void params.sessionId; // reserved for session-level policy overrides

  const [tool] = await db
    .select()
    .from(toolsRegistry)
    .where(eq(toolsRegistry.id, params.toolId))
    .limit(1);

  if (!tool) {
    return {
      allowed: false,
      reason: "Tool not registered",
      requires_approval: false,
      approval_id: null,
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
        allowed: false,
        reason: `Missing active secret for provider: ${tool.requiredSecretProvider}`,
        requires_approval: false,
        approval_id: null,
      };
    }
  }

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
      allowed: false,
      reason: "Tool not enabled for this agent/tenant",
      requires_approval: false,
      approval_id: null,
    };
  }

  if (tool.requiresApproval) {
    return {
      allowed: true,
      reason: null,
      requires_approval: true,
      approval_id: null,
    };
  }

  return {
    allowed: true,
    reason: null,
    requires_approval: false,
    approval_id: null,
  };
}
