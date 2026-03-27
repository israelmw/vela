// Agents
export type AgentStatus = "active" | "inactive" | "archived";

// Sessions
export type SessionStatus = "active" | "idle" | "closed";

// Runs
export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type RunStepType =
  | "tool_call"
  | "reasoning"
  | "approval_gate"
  | "subagent"
  | "artifact";

export type RunStepStatus =
  | "pending"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "skipped";

// Approvals
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalType =
  | "tool_call"
  | "external_action"
  | "secret_use"
  | "subagent_spawn"
  | "policy_override";

/** Auditable vote stored on `approvals.votes` (JSON). */
export type ApprovalVote = {
  actor: string;
  action: "approve" | "reject";
  at: string;
  /** Present for `reject` when a written reason is required. */
  reason?: string;
};

/** Embedded skill definition shipped inside an OSS capability pack. */
export type CapabilityManifestSkill = {
  id: string;
  name: string;
  description: string;
  version: string;
  instructions: string;
  requiredTools?: string[];
  requiredMcp?: string[];
  files?: string[];
};

/** OSS capability pack manifest (subset; extend as needed). */
export type CapabilityManifest = {
  skills?: CapabilityManifestSkill[];
  tools?: string[];
  description?: string;
};

/** Maximum nested subagent depth (parent run → child runs). */
export const MAX_SUBAGENT_DEPTH = 3;

// Artifacts
export type ArtifactType = "file" | "patch" | "report" | "data" | "log";

// Skills
export type SkillSource = "default" | "dynamic";

// Tools
export type ToolExecutorType = "builtin" | "mcp" | "channel";

// Channels
export type ChannelType = "slack" | "web" | "discord" | "teams";

// Secrets
export type AuthType = "none" | "oauth" | "api_key" | "secret";

export type SecretBindingStatus = "active" | "expired" | "revoked";

/** Run / ops observability (persisted JSON logs). */
export type RunEventLevel = "info" | "warn" | "error" | "debug";

// Policy
export interface PolicyResult {
  allowed: boolean;
  reason: string | null;
  requires_approval: boolean;
  approval_id: string | null;
}

// Sandbox
export type SandboxStatus =
  | "created"
  | "ready"
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "destroyed";

/** Stable default tenant for single-tenant dev / v1. */
export const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";

// Events (web channel)
export interface WebEventPayload {
  text: string;
  tenantId?: string;
  channelRef?: string;
}

export interface WebEventResult {
  threadId: string;
  sessionId: string;
  runId: string;
  userMessageId: string;
}
