import type { ApprovalType } from "@vela/types";

const META_KEYS = new Set([
  "quorumRequired",
  "expiresInMinutes",
  "approvalType",
]);

function isApprovalType(v: unknown): v is ApprovalType {
  return (
    v === "tool_call" ||
    v === "external_action" ||
    v === "secret_use" ||
    v === "subagent_spawn" ||
    v === "policy_override"
  );
}

/**
 * Strips workflow-level approval metadata from tool args before policy/exec.
 * JSON workflow steps may include quorumRequired, expiresInMinutes, approvalType.
 */
export function stripApprovalToolMeta(toolInput: unknown): {
  cleanArgs: unknown;
  quorumRequired: number | undefined;
  expiresInMinutes: number | undefined;
  approvalType: ApprovalType | undefined;
} {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return {
      cleanArgs: toolInput,
      quorumRequired: undefined,
      expiresInMinutes: undefined,
      approvalType: undefined,
    };
  }

  const src = toolInput as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  let quorumRequired: number | undefined;
  let expiresInMinutes: number | undefined;
  let approvalType: ApprovalType | undefined;

  for (const [k, v] of Object.entries(src)) {
    if (!META_KEYS.has(k)) {
      clean[k] = v;
      continue;
    }
    if (k === "quorumRequired" && typeof v === "number" && v >= 1) {
      quorumRequired = Math.floor(v);
    }
    if (k === "expiresInMinutes" && typeof v === "number" && v > 0) {
      expiresInMinutes = Math.floor(v);
    }
    if (k === "approvalType" && isApprovalType(v)) {
      approvalType = v;
    }
  }

  return { cleanArgs: clean, quorumRequired, expiresInMinutes, approvalType };
}

export function expiresAtFromMinutes(minutes: number | undefined): Date | null {
  if (minutes === undefined) return null;
  return new Date(Date.now() + minutes * 60_000);
}
