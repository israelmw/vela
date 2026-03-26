import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "inactive",
  "archived",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "idle",
  "closed",
]);

export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const runStepTypeEnum = pgEnum("run_step_type", [
  "tool_call",
  "reasoning",
  "approval_gate",
  "subagent",
  "artifact",
]);

export const runStepStatusEnum = pgEnum("run_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const approvalTypeEnum = pgEnum("approval_type", [
  "tool_call",
  "external_action",
  "secret_use",
  "subagent_spawn",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "file",
  "patch",
  "report",
  "data",
  "log",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "slack",
  "web",
  "discord",
  "teams",
]);

export const toolExecutorTypeEnum = pgEnum("tool_executor_type", [
  "builtin",
  "mcp",
  "channel",
]);

export const skillSourceEnum = pgEnum("skill_source", ["default", "dynamic"]);

export const sandboxStatusEnum = pgEnum("sandbox_status", [
  "created",
  "ready",
  "running",
  "suspended",
  "completed",
  "failed",
  "destroyed",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  defaultSkills: text("default_skills").array().notNull().default([]),
  allowedChannels: text("allowed_channels").array().notNull().default([]),
  tenantId: uuid("tenant_id").notNull(),
  status: agentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: channelTypeEnum("channel").notNull(),
  channelRef: text("channel_ref").notNull(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  tenantId: uuid("tenant_id").notNull(),
  status: sessionStatusEnum("status").notNull().default("active"),
  memorySnapshotId: uuid("memory_snapshot_id"),
  activeSkills: text("active_skills").array().notNull().default([]),
  contextSummary: text("context_summary"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  toolCallId: text("tool_call_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  trigger: text("trigger").notNull(),
  status: runStatusEnum("status").notNull().default("pending"),
  plan: jsonb("plan"),
  currentStep: integer("current_step").notNull().default(0),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  resultSummary: text("result_summary"),
  artifactsCount: integer("artifacts_count").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const runSteps = pgTable("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  stepIndex: integer("step_index").notNull(),
  type: runStepTypeEnum("type").notNull(),
  status: runStepStatusEnum("status").notNull().default("pending"),
  toolName: text("tool_name"),
  toolInput: jsonb("tool_input"),
  toolResult: jsonb("tool_result"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const skillsRegistry = pgTable("skills_registry", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  version: text("version").notNull(),
  instructions: text("instructions").notNull(),
  files: text("files").array().notNull().default([]),
  requiredTools: text("required_tools").array().notNull().default([]),
  requiredMcp: text("required_mcp").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runSkills = pgTable("run_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  skillId: text("skill_id")
    .notNull()
    .references(() => skillsRegistry.id),
  source: skillSourceEnum("source").notNull(),
  loadedAt: timestamp("loaded_at").notNull().defaultNow(),
});

export const toolsRegistry = pgTable("tools_registry", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  inputSchema: jsonb("input_schema").notNull(),
  executorType: toolExecutorTypeEnum("executor_type").notNull(),
  executorRef: text("executor_ref").notNull(),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  scope: text("scope").notNull(),
});

export const toolBindings = pgTable("tool_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  tenantId: uuid("tenant_id").notNull(),
  toolId: text("tool_id")
    .notNull()
    .references(() => toolsRegistry.id),
  enabled: boolean("enabled").notNull().default(true),
  policyOverrides: jsonb("policy_overrides"),
});

export const mcpRegistry = pgTable("mcp_registry", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authType: text("auth_type").notNull(),
  secretRef: text("secret_ref"),
});

export const secretBindings = pgTable("secret_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  provider: text("provider").notNull(),
  scope: text("scope").notNull(),
  secretRef: text("secret_ref").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  runStepId: uuid("run_step_id")
    .notNull()
    .references(() => runSteps.id),
  type: approvalTypeEnum("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  name: text("name").notNull(),
  type: artifactTypeEnum("type").notNull(),
  blobPath: text("blob_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sandboxes = pgTable("sandboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  status: sandboxStatusEnum("status").notNull().default("created"),
  snapshotBlobPath: text("snapshot_blob_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  destroyedAt: timestamp("destroyed_at"),
});
