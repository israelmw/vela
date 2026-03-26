import type { PolicyResult } from "@vela/types";

export type { DB } from "@vela/db";

export function canUseTool(
  _agentId: string,
  _sessionId: string,
  _toolId: string,
): PolicyResult {
  return {
    allowed: false,
    reason: "not implemented",
    requires_approval: false,
    approval_id: null,
  };
}
