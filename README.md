# Vela

> A cloud-native agent operating system. Multi-channel. Durable. Governed.

**Vela** is an open-source framework for building production-grade AI agent systems on top of Vercel-native primitives. It is not a chatbot library. It is not a prompt wrapper. It is a full operating system for agents: channels, control plane, skill resolution, durable execution, sandboxed compute, and governed capabilities — all running stateless in the cloud.

Inspired by the architecture of OpenClaw/OpenCode, rebuilt from scratch for serverless environments.

### Project scope

**Vela is intentionally Vercel-first.** The design targets Vercel primitives you already run in production: Fluid Compute, AI Gateway (model strings + OIDC), Blob, routing, and (when you need it) durable workflow patterns compatible with that stack. Porting to other clouds is not a goal for early versions; if abstractions fall out naturally later, they can be documented then.

### Current status

This repository is **early scaffolding**: the workspace and package boundaries exist; runnable apps, migrations, and channel integrations are still on the [roadmap](#roadmap). Treat this README as the **design contract** until the code catches up.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Architecture overview](#architecture-overview)
- [Layers](#layers)
- [Control Plane — entities & schema](#control-plane--entities--schema)
- [Contracts — Skills vs Tools vs MCP vs Subagents](#contracts--skills-vs-tools-vs-mcp-vs-subagents)
- [Policy Engine](#policy-engine)
- [Sandbox Lifecycle](#sandbox-lifecycle)
- [Monorepo Structure](#monorepo-structure)
- [Resolution Pipeline](#resolution-pipeline)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists

Most agent frameworks solve the wrong problem.

They focus on the loop — the LLM calling tools, the tools returning results. That part is actually the easy part. What they don't solve:

- How do you maintain state across a stateless runtime?
- How do you govern what an agent can and cannot do, per tenant, per session?
- How do you safely execute long-running tasks with retries, approvals, and durable artifacts?
- How do you expand an agent's capabilities without bloating every single context window?
- How do you isolate execution without running your own infrastructure?

**Vela** is the answer to those questions.

---

## Architecture overview

```
User
 └── Channels (Chat SDK)         Slack / Web / Discord / Teams
      └── Interaction Layer       onMessage / onMention / onInteraction
           └── Control Plane      Agents / Sessions / Threads / Policies / Approvals
                ├── Admin UI / Observability
                ├── Agent Runtime (AI SDK Tool Loop)
                │    ├── Memory Layer             short-term / working / long-term
                │    ├── Skill Resolver            search / load / attach
                │    └── Tool Router              Core Tools / MCP / Channel Tools
                │         ├── Workflow Layer       durable long-running executions
                │         │    └── Sandbox Layer   isolated execution environment
                │         └── Capability Layer     Secrets / OAuth / Policies / Approvals
                │              └── MCP Servers     GitHub / Vercel / Docs / Linear / DB
                └── Artifacts & State             Postgres / Blob / Vector Store
```

The key architectural insight:

> The old daemon-based gateway (OpenClaw's always-on process) is replaced by a **persisted Control Plane**. State lives in the database, not in memory.

---

## Layers

### Interaction Layer
Normalizes events from any channel into a unified format. Uses [Chat SDK](https://chat-sdk.dev) adapters. Does not contain business logic.

**Responsibilities:**
- Receive raw channel events
- Normalize to internal event format
- Emit to Control Plane

**Does not:**
- Make agent decisions
- Manage session state
- Call tools directly

---

### Control Plane
The single source of truth for the entire system. Every agent, session, run, policy, and approval lives here.

See [Control Plane — entities & schema](#control-plane--entities--schema) for the full data model.

**Responsibilities:**
- Register and configure agents
- Manage sessions and threads
- Track runs and steps
- Gate tool and skill access via policies
- Manage approval queues
- Bind secrets to agents/tenants

---

### Agent Runtime
The AI SDK tool-loop executor. Receives resolved context (session, memory, tools, skills) from the Control Plane and runs the reasoning loop.

**Responsibilities:**
- Run the LLM tool loop
- Call tools via the Tool Router
- Decide when to ask for approval
- Return structured results to the Control Plane

**Does not:**
- Manage state
- Resolve permissions
- Make lifecycle decisions about runs or sessions

> The loop reasons. The system governs.

---

### Skill Resolver
Loads capabilities into the agent on demand. The agent does not start with all skills preloaded — it discovers and requests them based on the task at hand.

See [Contracts — Skills vs Tools vs MCP vs Subagents](#contracts--skills-vs-tools-vs-mcp-vs-subagents).

---

### Tool Router
Routes tool calls to the correct executor: a core built-in tool, an MCP server, or a channel-specific action. Enforces policies before execution.

---

### Workflow Layer
Handles long-running, durable executions. Powered by Vercel/Inngest-style durable workflow primitives. Decoupled from the agent loop.

See [Sandbox Lifecycle](#sandbox-lifecycle).

---

### Capability Layer
Manages secrets, OAuth tokens, scopes, and approvals. The agent never sees raw credentials — it receives a delegated capability.

---

### Artifacts & State
Postgres for structured state and metadata. Blob for artifacts and snapshots. Vector store for long-term memory retrieval.

---

## Control Plane — entities & schema

The Control Plane is only as strong as its data model. These are the core entities.

### `agents`
```ts
{
  id: uuid
  name: string
  description: string
  model: string                   // e.g. AI Gateway: "anthropic/claude-sonnet-4.6", "openai/gpt-5.4"
  system_prompt: string
  default_skills: string[]        // skill IDs preloaded on every session
  allowed_channels: string[]
  tenant_id: uuid
  created_at: timestamp
  updated_at: timestamp
}
```

### `threads`
A thread is a channel-level conversation object (Slack thread, web session, etc.).
```ts
{
  id: uuid
  channel: string                 // "slack" | "web" | "discord" | "teams"
  channel_ref: string             // Slack thread_ts, Discord message ID, etc.
  agent_id: uuid
  tenant_id: uuid
  created_at: timestamp
}
```

### `sessions`
A session is the agent's live context within a thread. One thread may have multiple sessions over time.
```ts
{
  id: uuid
  thread_id: uuid
  agent_id: uuid
  tenant_id: uuid
  status: "active" | "idle" | "closed"
  memory_snapshot_id: uuid | null
  active_skills: string[]
  context_summary: string | null
  started_at: timestamp
  ended_at: timestamp | null
}
```

### `messages`
```ts
{
  id: uuid
  session_id: uuid
  thread_id: uuid
  role: "user" | "assistant" | "tool" | "system"
  content: string | object
  tool_call_id: string | null
  created_at: timestamp
}
```

### `runs`
A run is a discrete unit of durable work initiated by the agent.
```ts
{
  id: uuid
  session_id: uuid
  agent_id: uuid
  trigger: string                 // what caused this run
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled"
  plan: object | null             // structured plan before execution
  current_step: number
  requires_approval: boolean
  result_summary: string | null
  artifacts_count: number
  error: string | null
  started_at: timestamp
  ended_at: timestamp | null
}
```

### `run_steps`
```ts
{
  id: uuid
  run_id: uuid
  step_index: number
  type: "tool_call" | "reasoning" | "approval_gate" | "subagent" | "artifact"
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  tool_name: string | null
  tool_input: object | null
  tool_result: object | null
  started_at: timestamp
  ended_at: timestamp | null
}
```

### `skills_registry`
```ts
{
  id: string                      // e.g. "github-pr-review"
  name: string
  description: string
  version: string
  instructions: string            // injected into system prompt when loaded
  files: string[]                 // blob paths for templates, scripts, etc.
  required_tools: string[]        // tool IDs this skill depends on
  required_mcp: string[]          // MCP server IDs needed
  created_at: timestamp
}
```

### `run_skills`
Skills attached to a specific run (union of session defaults + dynamic loads).
```ts
{
  id: uuid
  run_id: uuid
  skill_id: string
  loaded_at: timestamp
  source: "default" | "dynamic"   // how it was attached
}
```

### `tools_registry`
```ts
{
  id: string                      // e.g. "github.create_pr"
  name: string
  description: string
  input_schema: object            // JSON Schema
  executor_type: "builtin" | "mcp" | "channel"
  executor_ref: string            // MCP server ID or builtin handler name
  requires_approval: boolean
  scope: string                   // e.g. "github:write"
}
```

### `tool_bindings`
Which tools are enabled for which agent/tenant combination.
```ts
{
  id: uuid
  agent_id: uuid
  tenant_id: uuid
  tool_id: string
  enabled: boolean
  policy_overrides: object | null
}
```

### `mcp_registry`
```ts
{
  id: string                      // e.g. "github-mcp"
  name: string
  url: string
  auth_type: "none" | "oauth" | "api_key" | "secret"
  secret_ref: string | null
}
```

### `secret_bindings`
```ts
{
  id: uuid
  tenant_id: uuid
  agent_id: uuid | null           // null = tenant-level
  provider: string                // "github" | "linear" | "notion" | etc.
  scope: string                   // "read" | "write" | "admin"
  secret_ref: string              // pointer into secret store (never the value)
  expires_at: timestamp | null
  created_at: timestamp
}
```

### `approvals`
```ts
{
  id: uuid
  run_id: uuid
  run_step_id: uuid
  type: "tool_call" | "external_action" | "secret_use" | "subagent_spawn"
  payload: object                 // what is being approved
  status: "pending" | "approved" | "rejected" | "expired"
  requested_at: timestamp
  resolved_at: timestamp | null
  resolved_by: string | null      // user ID or "auto"
}
```

### `artifacts`
```ts
{
  id: uuid
  run_id: uuid
  name: string
  type: "file" | "patch" | "report" | "data" | "log"
  blob_path: string
  mime_type: string
  size_bytes: number
  created_at: timestamp
}
```

---

## Contracts — Skills vs Tools vs MCP vs Subagents

These four primitives are distinct. Conflating them creates an unmanageable system.

### Skill
A **skill** adds procedure, not permissions.

A skill is a bundle of:
- Instructions injected into the agent's system prompt
- Optional templates, reference files, or scripts (stored in Blob)
- Declarations of which tools and MCP servers it requires

A skill **does not** grant new permissions. It declares what it needs, and the policy engine decides whether those requirements are already satisfied.

```
Skill: "github-pr-review"
  instructions: "When reviewing a PR, first fetch the diff, then..."
  required_tools: ["github.get_pr_diff", "github.post_review_comment"]
  required_mcp: ["github-mcp"]
```

**When to use a skill:** you want to change how the agent thinks and operates for a category of task, without adding new system-level capabilities.

---

### Tool
A **tool** is an executable capability with a stable interface.

Tools are registered in `tools_registry` with a JSON Schema input contract. They are invoked by the agent loop via the Tool Router. The Tool Router validates that the tool is bound and policy-cleared before executing.

Tool types:
- `builtin` — logic lives in the codebase
- `mcp` — delegated to an MCP server
- `channel` — channel-specific actions (e.g. "reply to thread", "create ticket")

**When to use a tool:** you need a discrete, typed, auditable action that the agent can call by name.

---

### MCP Server
An MCP server is an **external source of tools and/or resources**.

MCP servers expose their own tool catalog. The Tool Router registers those tools dynamically at startup and routes calls to the server. The agent never talks to an MCP server directly — it calls tools, and the Tool Router resolves the executor.

MCP server connections are stored in `mcp_registry` and scoped to tenants via `secret_bindings`.

**When to use MCP:** you want to integrate an external system (GitHub, Linear, Vercel, Notion) and consume its native tool surface without reimplementing it.

---

### Subagent
A **subagent** is a delegated reasoning unit — not a new source of privileges.

A subagent:
- Inherits a constrained subset of the parent session's tools and policies
- Cannot self-elevate permissions
- Cannot spawn further subagents (in v1)
- Operates within a scoped context with its own run record

**When to use a subagent:** you want to parallelize reasoning or delegate a bounded subtask — not to expand what the system can do.

```
Parent agent: task decomposition, approval gating, final synthesis
Subagent:     one discrete sub-task with explicit inputs and outputs
```

---

### Summary table

| Primitive | Adds reasoning | Adds permissions | External system | Auditable |
|-----------|---------------|-----------------|-----------------|-----------|
| Skill     | ✅             | ❌               | ❌               | ✅         |
| Tool      | ❌             | ✅ (if bound)    | sometimes       | ✅         |
| MCP       | ❌             | ✅ (via binding) | ✅               | ✅         |
| Subagent  | ✅             | ❌ (inherited)   | ❌               | ✅         |

---

## Policy Engine

The policy engine is an explicit, centralized authorization layer. It runs **before** every consequential action in the system.

Rather than scattering permission checks across handlers, skills, and tool executors, all authorization flows through a single interface.

### Core policy functions

```ts
// Can this agent call this tool in this session?
canUseTool(agentId: string, sessionId: string, toolId: string): PolicyResult

// Does this tool call require human approval before execution?
requiresApproval(toolId: string, scope: string, resource: string): boolean

// Can this agent use this secret for this provider/scope?
canUseSecret(agentId: string, tenantId: string, provider: string, scope: string): PolicyResult

// Can this agent spawn a subagent from this template?
canSpawnSubagent(agentId: string, templateId: string): PolicyResult

// Can this agent load this skill in this session?
canLoadSkill(agentId: string, sessionId: string, skillId: string): PolicyResult
```

### `PolicyResult`
```ts
{
  allowed: boolean
  reason: string | null           // human-readable explanation if denied
  requires_approval: boolean      // true = allowed pending approval
  approval_id: uuid | null
}
```

### Policy evaluation order

1. **Tenant-level block** — hard limits set by the tenant admin
2. **Agent-level binding** — tool must be present in `tool_bindings` for this agent/tenant
3. **Session-level override** — ephemeral grants or restrictions on the current session
4. **Approval gate** — tool marked `requires_approval: true` in registry
5. **Scope check** — secret binding must cover the required scope

If any layer denies: the action is blocked and an audit record is created.
If approval is required: the run pauses, an `approvals` record is created, and the agent waits.

### Approval flow

```
Agent requests tool call
  → Policy engine: requires_approval = true
  → Run status → "awaiting_approval"
  → Approval record created
  → Notification sent to approver (via channel)
  → Approver responds
  → Approval resolved
  → Run resumes from current step
```

---

## Sandbox Lifecycle

The sandbox is an isolated execution environment for runs that require file system access, code execution, or side effects. It is **always ephemeral** — it is never the source of truth.

### Core principle

```
Sandbox = executor only.
Source of truth = DB (metadata) + Git/patchset (code) + Blob (artifacts).
```

### Lifecycle states

```
CREATED → READY → RUNNING → COMPLETED / FAILED → DESTROYED
                    ↓
               SUSPENDED (workflow paused, awaiting approval)
                    ↓
               RESUMED
```

### Rules

| Question | Answer |
|----------|--------|
| When is a sandbox created? | At the start of a run that requires execution |
| Is a sandbox reused across runs? | No. One sandbox per run. |
| What happens if the workflow is interrupted? | State is snapshotted to Blob. Sandbox is suspended or destroyed. |
| Can the agent read from a previous sandbox? | No. It reads from Blob artifacts and Git state. |
| When is a sandbox destroyed? | On run completion, failure, timeout, or explicit cancellation. |
| What persists after sandbox destruction? | Only what was explicitly written to Blob or committed to the repo. |

### Snapshot contract

Before a sandbox is destroyed or suspended, the workflow executor must flush:

1. **Code changes** → as a patchset to Git or Blob
2. **Generated files** → as artifacts to Blob, registered in `artifacts` table
3. **Logs** → appended to the run's log artifact
4. **Metadata** → run status, step status, error messages → to Postgres

Nothing else survives.

### Sandbox ↔ Workflow integration

```
Workflow step: "execute in sandbox"
  → Workflow creates sandbox
  → Passes input artifacts + context
  → Sandbox executes
  → Sandbox writes outputs to Blob
  → Workflow receives artifact references
  → Sandbox destroyed
  → Workflow continues to next step
```

The Workflow layer coordinates. The Sandbox layer only executes.

---

## Monorepo Structure

```
/
├── apps/                           # (planned) not in repo yet
│   ├── web/                        # Admin UI + observability dashboard (Next.js)
│   └── docs/                       # Public documentation site
│
├── packages/
│   ├── control-plane/              # Core entities, state machine, run orchestration
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   ├── sessions/
│   │   │   ├── runs/
│   │   │   ├── approvals/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── agent-runtime/              # AI SDK tool loop, context assembly, response handling
│   │   ├── src/
│   │   │   ├── loop/
│   │   │   ├── context-builder/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── skill-resolver/             # Skill registry, search, load, attach logic
│   │   ├── src/
│   │   │   ├── registry/
│   │   │   ├── resolver/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── tool-router/                # Tool registry, MCP bridge, policy pre-check, execution
│   │   ├── src/
│   │   │   ├── registry/
│   │   │   ├── mcp-bridge/
│   │   │   ├── channel-tools/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── policy-engine/              # canUseTool, canUseSecret, requiresApproval, etc.
│   │   ├── src/
│   │   │   ├── evaluators/
│   │   │   ├── approval-gate/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── workflow/                   # Durable run execution, step management, retries
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   ├── steps/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── sandbox/                    # Isolated executor, snapshot management, lifecycle
│   │   ├── src/
│   │   │   ├── lifecycle/
│   │   │   ├── snapshot/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── memory/                     # Short-term, working memory, long-term vector retrieval
│   │   ├── src/
│   │   │   ├── short-term/
│   │   │   ├── working/
│   │   │   ├── long-term/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── channels/                   # Chat SDK adapters: Slack, Web, Discord, Teams
│   │   ├── src/
│   │   │   ├── slack/
│   │   │   ├── web/
│   │   │   ├── discord/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── db/                         # Postgres schema, migrations, typed query layer
│   │   ├── migrations/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── types/                      # Shared TypeScript types across all packages
│       ├── src/
│       └── package.json
│
├── skills/                         # Built-in skills (community skills go here via PR)
│   ├── github-pr-review/
│   ├── linear-issue-triage/
│   └── ...
│
├── tools/                          # Built-in core tools
│   ├── web-search/
│   ├── code-eval/
│   └── ...
│
├── turbo.json
├── pnpm-workspace.yaml
├── LICENSE                         # MIT — full legal text
└── README.md
```

### Package dependency rules

```
channels         → control-plane, types
control-plane    → db, policy-engine, types
agent-runtime    → skill-resolver, tool-router, memory, types
skill-resolver   → db, types
tool-router      → policy-engine, db, types
policy-engine    → db, types
workflow         → sandbox, db, types
sandbox          → types
memory           → db, types
db               → types
```

No circular dependencies. `types` and `db` are the only shared leaves.

---

## Resolution Pipeline

Before the agent loop runs, the system resolves the full execution context in a fixed, ordered pipeline:

```
1. Resolve thread
     └── Find or create thread record from channel event

2. Resolve session
     └── Find active session for thread + agent, or create new one

3. Resolve agent
     └── Load agent config, system prompt, model

4. Resolve memory
     └── Load short-term (recent messages) + working (current task context)
     └── Query long-term if relevant (vector similarity)

5. Resolve policies
     └── Load tool bindings, secret bindings, session overrides for this agent/tenant

6. Resolve candidate skills
     └── Skill resolver: based on message intent, what skills should be active?

7. Resolve effective tools
     └── Tool Router: given active skills + tool bindings + policies, what tools are available?

8. Run agent loop
     └── AI SDK: reason, call tools, receive results, respond
```

The agent receives a fully assembled context. It does not need to discover or negotiate its own environment.

---

## Roadmap

### v1 — Core system
- [ ] Slack channel (Chat SDK adapter)
- [ ] Control Plane — full entity schema + Postgres migrations
- [ ] Agent Runtime — AI SDK tool loop
- [ ] Skill Resolver — static registry + manual load
- [ ] Tool Router — builtin + MCP bridge
- [ ] Policy Engine — tool bindings + basic approval gate
- [ ] Workflow — simple durable runs (Vercel-native path first; cron/step patterns as needed)
- [ ] Sandbox — basic isolated executor
- [ ] Memory — short-term + working
- [ ] Admin UI — run inspector, approval queue
- [ ] 2–3 built-in tools (web search, code eval, channel reply)
- [ ] 2–3 built-in skills (PR review, issue triage)

### v2 — Capability expansion
- [ ] Additional channels (Web, Discord, Teams)
- [ ] OAuth + full secret lifecycle (rotation, expiration, revocation)
- [ ] Long-term vector memory
- [ ] Subagent support (template-based, no nesting)
- [ ] Richer admin UI with observability
- [ ] MCP registry + dynamic tool discovery

### v3 — Scale & ecosystem
- [ ] Multi-tenant SaaS mode
- [ ] Skills marketplace (community contributions)
- [ ] Advanced approval workflows
- [ ] Dynamic subagent spawning
- [ ] Capability marketplace

---

## Contributing

Pull requests are welcome once there is enough code to run and test. Until then:

- Open issues for design questions or inconsistencies with this README.
- Proposed **skills** live under `skills/`; **core tools** under `tools/` — follow the contracts in [Skills vs Tools vs MCP vs Subagents](#contracts--skills-vs-tools-vs-mcp-vs-subagents).
- Run `pnpm install` at the repo root, then `pnpm typecheck` / `pnpm build` when those tasks are wired in packages.

A fuller `CONTRIBUTING.md` can land once the first vertical slice (e.g. Slack webhook → control plane stub) exists.

---

## License

Licensed under the **MIT License** — see [`LICENSE`](./LICENSE) for the full text. That file is what redistributors and lawyers look for; a one-line mention in the README is not a substitute.