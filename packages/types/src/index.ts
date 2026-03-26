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
  | "completed"
  | "failed"
  | "skipped";

// Approvals
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalType =
  | "tool_call"
  | "external_action"
  | "secret_use"
  | "subagent_spawn";

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
