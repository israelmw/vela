import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  primaryKey,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  uniqueIndex,
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
  "retrying",
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
  "policy_override",
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

export const secretBindingStatusEnum = pgEnum("secret_binding_status", [
  "active",
  "expired",
  "revoked",
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
  /** When set, this run was spawned by another run (subagent). */
  parentRunId: uuid("parent_run_id").references(
    (): AnyPgColumn => runs.id,
  ),
  subagentDepth: integer("subagent_depth").notNull().default(0),
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

export const runSteps = pgTable(
  "run_steps",
  {
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
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at"),
    idempotencyKey: text("idempotency_key"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (t) => ({
    idemUnique: uniqueIndex("run_steps_run_id_idempotency_key_unique").on(
      t.runId,
      t.idempotencyKey,
    ),
  }),
);

/** Working memory: key-value overlay per session (run-scoped reads via session). */
export const workingMemory = pgTable(
  "working_memory",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.key] })],
);

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
  /** If set, an active non-expired secret binding must exist for this provider key. */
  requiredSecretProvider: text("required_secret_provider"),
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
  capabilityTags: text("capability_tags").array().notNull().default([]),
  requiredScopes: text("required_scopes").array().notNull().default([]),
  lastHealthCheck: timestamp("last_health_check"),
  lastHealthOk: boolean("last_health_ok"),
  meta: jsonb("meta"),
});

export const mcpDiscoveredTools = pgTable(
  "mcp_discovered_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mcpId: text("mcp_id")
      .notNull()
      .references(() => mcpRegistry.id),
    toolName: text("tool_name").notNull(),
    description: text("description").notNull().default(""),
    inputSchema: jsonb("input_schema").notNull(),
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("mcp_discovered_tools_mcp_tool_unique").on(
      t.mcpId,
      t.toolName,
    ),
  }),
);

export const secretBindings = pgTable("secret_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  provider: text("provider").notNull(),
  scope: text("scope").notNull(),
  secretRef: text("secret_ref").notNull(),
  status: secretBindingStatusEnum("status").notNull().default("active"),
  rotatedAt: timestamp("rotated_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Long-term memory chunks with embedding vectors (JSON array of floats, dim arbitrary). */
export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  runId: uuid("run_id").references(() => runs.id),
  content: text("content").notNull(),
  embedding: jsonb("embedding").notNull(),
  meta: jsonb("meta"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Operational / observability events for runs (admin UI, drains). */
export const runEvents = pgTable("run_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  stepIndex: integer("step_index"),
  level: text("level").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  meta: jsonb("meta"),
  requestId: text("request_id"),
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
  /** When set, approval auto-expires (workflow checks + API listing). */
  expiresAt: timestamp("expires_at"),
  /** Required on reject (auditable OSS workflow). */
  rejectionReason: text("rejection_reason"),
  /** Approving votes needed before executing gated action (1 = single approver). */
  quorumRequired: integer("quorum_required").notNull().default(1),
  /** JSON array: { actor, action: approve|reject, at } */
  votes: jsonb("votes").notNull().default(sql`'[]'::jsonb`),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  runStepId: uuid("run_step_id").references(() => runSteps.id),
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

/** OSS capability pack registry (manifest lists skills/tools metadata). */
export const capabilityPackages = pgTable("capability_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ref: text("ref").notNull().unique(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  manifest: jsonb("manifest").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Tenant/agent scoped install of a capability pack. */
export const capabilityInstalls = pgTable("capability_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  packageRef: text("package_ref").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config"),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
});
