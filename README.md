# Vela

> A cloud-native agent operating system. Multi-channel. Durable. Governed.

**Vela** is an open-source framework for building production-grade AI agent systems on top of Vercel-native primitives. It is not a chatbot library. It is not a prompt wrapper. It is a full operating system for agents: channels, control plane, skill resolution, durable execution, sandboxed compute, and governed capabilities — all running stateless in the cloud.

Inspired by the architecture of OpenClaw/OpenCode, rebuilt from scratch for serverless environments.

### Project scope

**Vela is intentionally Vercel-first.** The design targets Vercel primitives you already run in production: Fluid Compute, AI Gateway (model strings + OIDC), Blob, routing, and (when you need it) durable workflow patterns compatible with that stack. Porting to other clouds is not a goal for early versions; if abstractions fall out naturally later, they can be documented then.

### Current status

**v2 capability expansion (current slice):** Web + Slack + Discord + Teams ingest through the shared control plane; chat platforms use the **[Vercel Chat SDK](https://chat-sdk.dev/)** (`chat`, `@chat-adapter/*`) into **`apps/web/lib/ingest.ts`**; secret bindings support **active / expired / revoked** with rotate/revoke APIs and policy enforcement when `tools_registry.required_secret_provider` is set; **long-term memory** (opt-in via `VELA_LONG_TERM_MEMORY`) with embedding + cosine retrieval; **MCP registry** with sync/discovery and policy-gated execution; **run_events** for step-level observability in the admin console (`/console/runs`, `/console/runs/[id]`, `/console/secrets`, `/console/mcp`, etc.). Production still expects **Vercel + Neon + Blob** (and AI Gateway / OIDC when using the LLM path). See [Cloud quickstart](#cloud-quickstart) and [CONTRIBUTING.md](./CONTRIBUTING.md).

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
- [Cloud quickstart](#cloud-quickstart)
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
 └── Channels                  Slack / Web / Discord / Teams
      └── Interaction Layer       Chat SDK + Next.js webhooks → ingest
           └── Control Plane      Agents / Sessions / Threads / Policies / Approvals
                ├── Admin UI / Observability
                ├── Agent Runtime (AI SDK Tool Loop)
                │    ├── Memory Layer             short-term / working / long-term
                │    ├── Skill Resolver            search / load / attach
                │    └── Tool Router              Core Tools / MCP / Channel Tools
                │         ├── Workflow Layer       durable long-running executions
                │         │    └── Sandbox Layer   isolated execution environment
                │         └── Capability Layer     Secret bindings / policies / approvals / MCP registry
                └── Artifacts & State             Postgres (incl. memory_embeddings) / Blob
```

The key architectural insight:

> The old daemon-based gateway (OpenClaw's always-on process) is replaced by a **persisted Control Plane**. State lives in the database, not in memory.

---

## Layers

### Interaction Layer
Multi-channel inbound events go through the **[Chat SDK](https://chat-sdk.dev/)** in **`apps/web/lib/chat-bot.ts`**: a single **`Chat`** instance registers **`@chat-adapter/slack`**, **`@chat-adapter/discord`**, and **`@chat-adapter/teams`** (each enabled only when the matching env vars are set). Webhooks are thin **`POST`** handlers that call **`dispatchChatWebhook`** with [`next/server` `after`](https://nextjs.org/docs/app/api-reference/functions/after) for background work. Handlers (**`onNewMention`**, **`onNewMessage`**, **`onSubscribedMessage`**) call **`ingestUserMessage`** with normalized text and a stable **`thread.id`** as **`channelRef`**. **`POST /api/events/web`** stays a first-class path for non-Chat browser/demo traffic. Subscriptions and locks use **`@chat-adapter/state-redis`** when **`REDIS_URL`** is set, otherwise **`@chat-adapter/state-memory`** (dev / single-instance only). Low-level helpers for tests or custom tooling remain in **`packages/channels`**.

**Responsibilities:**
- Receive platform webhooks (`/api/channels/slack/events`, `/api/channels/discord/interactions`, `/api/channels/teams/messages`) or web UI events (`/api/events/web`)
- Route through Chat SDK adapters + state
- Forward user text into **`ingestUserMessage`** (threads, sessions, runs)

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
Linear durable execution in **`packages/workflow`**: user messages that start with `workflow:` carry a JSON step list; steps run with retries, `retrying` / `next_retry_at`, optional approval gates (including quorum and expiry metadata from step args), and integration with **`packages/sandbox`**. Decoupled from the default LLM tool loop except where the runtime triggers workflow continuation.

See [Sandbox Lifecycle](#sandbox-lifecycle).

---

### Capability Layer
Manages **secret bindings** (opaque refs + lifecycle), **approvals**, and policy checks applied before tool execution. This repo does not ship a full identity/OAuth server—wire tokens via your store and **`secret_ref`**.

---

### Artifacts & State
Postgres for structured state, **including `memory_embeddings`** (JSON float vectors + application-side cosine retrieval when long-term memory is enabled). Blob for artifacts and sandbox snapshots.

---

## Control Plane — entities & schema

Authoritative definitions live in **`packages/db/src/schema.ts`** and SQL migrations under **`packages/db/migrations`**. Below is what is actually deployed today.

### `agents`
```ts
{
  id: uuid
  name: string
  description: string | null
  model: string
  system_prompt: string
  default_skills: string[]
  allowed_channels: string[]      // maps to channel_type enum where used
  tenant_id: uuid
  status: "active" | "inactive" | "archived"
  created_at, updated_at: timestamp
}
```

### `threads`
```ts
{
  id: uuid
  channel: "slack" | "web" | "discord" | "teams"
  channel_ref: string
  agent_id: uuid
  tenant_id: uuid
  created_at: timestamp
}
```

### `sessions`
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
  started_at, ended_at: timestamp | null
}
```

### `messages`
```ts
{
  id: uuid
  session_id: uuid
  thread_id: uuid
  role: string                     // e.g. user / assistant / tool / system (stored as text)
  content: jsonb                   // normalized message body
  tool_call_id: string | null
  created_at: timestamp
}
```

### `runs`
```ts
{
  id: uuid
  session_id: uuid
  agent_id: uuid
  parent_run_id: uuid | null       // child run when spawned as subagent
  subagent_depth: number           // default 0; incremented for child runs
  trigger: string
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled"
  plan: jsonb | null
  current_step: number
  requires_approval: boolean
  result_summary: string | null
  artifacts_count: number
  error: string | null
  started_at, ended_at: timestamp | null
}
```

### `run_steps`
```ts
{
  id: uuid
  run_id: uuid
  step_index: number
  type: "tool_call" | "reasoning" | "approval_gate" | "subagent" | "artifact"
  status: "pending" | "running" | "retrying" | "completed" | "failed" | "skipped"
  tool_name, tool_input, tool_result: optional json / text
  attempt: number                  // retry counter
  max_attempts: number
  last_error: string | null
  next_retry_at: timestamp | null
  idempotency_key: string | null   // unique per run when set
  started_at, ended_at: timestamp | null
}
```

### `working_memory`
Session-scoped key/value overlay (working set for prompts).
```ts
{
  session_id: uuid
  key: string
  value: jsonb
  updated_at: timestamp
}  // primary key (session_id, key)
```

### `skills_registry`
```ts
{
  id: string
  name: string
  description: string
  version: string
  instructions: string
  files: string[]
  required_tools: string[]
  required_mcp: string[]
  created_at: timestamp
}
```

### `run_skills`
```ts
{
  id: uuid
  run_id: uuid
  skill_id: string
  source: "default" | "dynamic"
  loaded_at: timestamp
}
```

### `tools_registry`
```ts
{
  id: string
  name: string
  description: string
  input_schema: jsonb
  executor_type: "builtin" | "mcp" | "channel"
  executor_ref: string            // builtin id, or "mcpId::toolName" for MCP-discovered tools
  requires_approval: boolean
  scope: string
  required_secret_provider: string | null  // provider key; active binding required for tool use
}
```

### `tool_bindings`
Per agent/tenant enablement for a tool id (`enabled`, optional `policy_overrides` jsonb).

### `mcp_registry`
```ts
{
  id: string
  name: string
  url: string
  auth_type: string               // e.g. none | oauth | api_key | secret
  secret_ref: string | null
  capability_tags: string[]
  required_scopes: string[]
  last_health_check: timestamp | null
  last_health_ok: boolean | null
  meta: jsonb | null
}
```

### `mcp_discovered_tools`
Catalog row per MCP tool after sync (`mcp_id`, `tool_name`, `description`, `input_schema`, `discovered_at`).

### `secret_bindings`
```ts
{
  id: uuid
  tenant_id: uuid
  agent_id: uuid | null           // null = tenant-wide
  provider: string
  scope: string
  secret_ref: string
  status: "active" | "expired" | "revoked"
  rotated_at, revoked_at: timestamp | null
  revoked_reason: string | null
  expires_at, created_at: timestamp | null
}
```

### `memory_embeddings`
Long-term chunks: `session_id`, optional `run_id`, `content`, `embedding` (jsonb float array), `meta`, optional `expires_at`, `created_at`.

### `run_events`
Operational timeline for admin UI / drains: `run_id`, optional `step_index`, `level`, `event_type`, `message`, `meta`, optional `request_id`, `created_at`.

### `approvals`
```ts
{
  id: uuid
  run_id: uuid
  run_step_id: uuid
  type: "tool_call" | "external_action" | "secret_use" | "subagent_spawn" | "policy_override"
  payload: jsonb
  status: "pending" | "approved" | "rejected" | "expired"
  expires_at: timestamp | null
  rejection_reason: string | null         // set on reject (required by API path)
  quorum_required: number                 // default 1; approve count must reach this
  votes: jsonb                            // array of { actor, action, at, reason? }
  requested_at, resolved_at: timestamp | null
  resolved_by: string | null
}
```

### `artifacts`
```ts
{
  id: uuid
  run_id: uuid
  run_step_id: uuid | null
  name: string
  type: "file" | "patch" | "report" | "data" | "log"
  blob_path: string
  mime_type: string
  size_bytes: number
  created_at: timestamp
}
```

### `sandboxes`
`run_id`, `status` (`created` → `ready` → `running` | `suspended` | `completed` | `failed` → `destroyed`), optional `snapshot_blob_path`, timestamps.

### `capability_packages` / `capability_installs`
Versioned OSS packs: `capability_packages` stores `ref`, `name`, `version`, `manifest` jsonb; `capability_installs` binds a `package_ref` to `tenant_id` and optional `agent_id` with `enabled` and optional `config`.

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

Tool types in schema:
- `builtin` — handlers in **`packages/tool-router`** (e.g. seeds like `vela.channel_reply_stub` are still registered as builtins today)
- `mcp` — JSON-RPC to a server after tools are synced into **`tools_registry`**
- `channel` — reserved enum value for future channel-native executors; not required for current seeds

**When to use a tool:** you need a discrete, typed, auditable action that the agent can call by name.

---

### MCP Server
An MCP server is an **external source of tools** surfaced as rows in `mcp_registry`. **`POST /api/mcp`** (sync) performs a JSON-RPC `tools/list` against the server URL, upserts rows in `mcp_discovered_tools`, and the tool router can materialize `tools_registry` entries with `executor_type: "mcp"` and `executor_ref` of the form `mcpId::toolName`. Execution uses JSON-RPC `tools/call` in **`packages/tool-router`**. Policy (`canUseTool`) and optional `required_secret_provider` apply the same as built-ins.

**When to use MCP:** you already run or subscribe to an MCP-compatible server and want those tools callable by name without hand-writing each integration in this repo.

---

### Subagent
A **subagent** here is a **child run** on the same `session_id` with `parent_run_id` set, `trigger: "subagent"`, and `subagent_depth` incremented. **`packages/agent-runtime`** enforces **`MAX_SUBAGENT_DEPTH` (3)** from **`@vela/types`**: deeper spawn request fails with a clear error. In the web UI, sending a message that starts with **`subagent:`** runs this path for the current run.

**When to use a subagent:** isolate a sub-goal in its own run record while keeping audit and approvals on the parent session context.

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

### Implemented in `packages/policy-engine`

- **`canUseTool(db, { agentId, tenantId, sessionId, toolId })`** — returns **`PolicyResult`**. Logic today: load `tools_registry` row; if **`required_secret_provider`** is set, require an **active** `secret_bindings` row for that tenant (agent-scoped or tenant-scoped) via **`findActiveSecretBinding`** (also runs **`expireStaleSecretBindings`**); require an **enabled** `tool_bindings` row; if the tool has **`requires_approval: true`**, result is **`allowed: true`** with **`requires_approval: true`** (approval is created later in the agent/tool path, not in this function).

- **Secret lifecycle** — **`createSecretBinding`**, **`rotateSecretBinding`**, **`revokeSecretBinding`**, **`listSecretBindings`**, **`expireStaleSecretBindings`** (used from tooling and from secret lookup).

There is **no** separate exported **`canUseSecret`**, **`canSpawnSubagent`**, or **`canLoadSkill`** yet; bindings and runtime gates cover what ships today.

### `PolicyResult`
```ts
{
  allowed: boolean
  reason: string | null           // human-readable explanation if denied
  requires_approval: boolean      // true = allowed pending approval
  approval_id: uuid | null
}
```

### Policy evaluation order (`canUseTool`)

1. Tool exists in **`tools_registry`**.
2. If **`required_secret_provider`** is set, an active, non-expired **`secret_bindings`** row must exist for that provider (housekeeping may mark past-due rows expired).
3. **`tool_bindings`** must exist with **`enabled: true`** for this agent and tenant.
4. If **`requires_approval`** on the tool: allow structurally but surface **`requires_approval: true`** so the runtime can pause and open an **`approvals`** row.

Session-level overrides are reserved (**`sessionId`** is currently unused inside **`canUseTool`**).

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

The workflow integrates with **`packages/sandbox`** to record sandbox sessions and linked **`artifacts`** (Blob paths in Postgres). What persists is whatever steps explicitly write to **Blob** and **`artifacts`**, plus **run** / **run_steps** status in Postgres. There is no automatic “flush everything to Git” in this repo today.

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
├── apps/
│   └── web/                        # Next.js: admin UI, `lib/ingest.ts`, `lib/chat-bot.ts` (Chat SDK)
│       ├── app/                    # routes + `/api/channels/*` webhooks
│       └── lib/
│
├── packages/
│   ├── control-plane/              # Runs, sessions, threads, messages helpers; service.ts
│   │   └── src/
│   ├── agent-runtime/              # loop.ts, resume.ts, subagent.ts, approvals.ts
│   │   └── src/
│   ├── skill-resolver/             # Keyword / intent routing to skills
│   │   └── src/
│   ├── tool-router/                # Builtin + MCP dispatch, mcp.ts
│   │   └── src/
│   ├── policy-engine/              # canUseTool, secret lifecycle (secrets.ts)
│   │   └── src/
│   ├── workflow/                   # Executor, retries, approval metadata on steps
│   │   └── src/
│   ├── sandbox/                    # DB-backed sandbox session + allowlisted ops
│   │   └── src/
│   ├── memory/                     # Short-term load, working_memory format, long-term.ts
│   │   └── src/
│   ├── channels/                 # slack | discord | teams helpers
│   │   └── src/
│   ├── capabilities/             # capability_packages + installs registry
│   │   └── src/
│   ├── db/                         # Drizzle schema + migrations
│   │   ├── migrations/
│   │   └── src/
│   └── types/                      # Shared TS types + constants (e.g. MAX_SUBAGENT_DEPTH)
│       └── src/
│
├── skills/                         # Seed / reference skill content (see repo)
├── tools/                          # Placeholder tree for future built-in tool layouts
│
├── turbo.json
├── pnpm-workspace.yaml
├── LICENSE
└── README.md
```

### Package dependency rules (approximate)

Workspace packages import **`@vela/db`** and **`@vela/types`** as leaves. **`apps/web`** composes **`control-plane`**, **`agent-runtime`**, **`workflow`**, **`capabilities`**, **`policy-engine`**, **`tool-router`**, and **`chat`** / **`@chat-adapter/*`** for multi-channel ingress (see **`package.json`**). **`packages/channels`** remains for optional helpers and tests. See each **`package.json`** for the exact graph.

---

## Resolution Pipeline

Before the agent loop runs, the system resolves the full execution context in a fixed, ordered pipeline:

```
1. Resolve thread
     └── From Chat SDK **`thread.id`** as **`channel_ref`** (or web **`channelRef`**) via **`getOrCreateThread`**

2. Resolve session
     └── Find active session for thread + agent, or create new one

3. Resolve agent
     └── Load agent config, system prompt, model

4. Resolve memory
     └── Load short-term (recent messages) + working (current task context)
     └── Query long-term if relevant (vector similarity)

5. Resolve policies
     └── Tool bindings + secret requirements enforced at tool call time (`canUseTool`); secret lifecycle helpers keep `secret_bindings` status accurate

6. Resolve candidate skills
     └── Skill resolver attaches skills for the run from registry + heuristics (see `@vela/skill-resolver`)

7. Resolve effective tools
     └── Tool Router: builtins, channel tools, and MCP-backed tools registered after sync; each call still passes `canUseTool`

8. Run agent loop
     └── AI SDK: reason, call tools, receive results, respond
```

The agent receives a fully assembled context. It does not need to discover or negotiate its own environment.

---

## Roadmap

### v1 — Core system
- [x] Slack channel — Events API verification + `POST /api/channels/slack/events`
- [x] Control Plane — entity schema + Postgres (Drizzle)
- [x] Agent Runtime — AI SDK loop + builtin tools
- [x] Skill Resolver — keyword routing + registry
- [x] Tool Router — builtins first; MCP surfaced in v2 (see below)
- [x] Policy Engine — tool bindings + approval gate
- [x] Workflow — durable linear executor (retries, `retrying` + `next_retry_at`, approvals between steps)
- [x] Sandbox — DB-backed sandbox session + allowlisted ops + Blob snapshot + `artifacts.run_step_id`
- [x] Memory — short-term transcript window + session `working_memory` KV
- [x] Admin UI — run inspector, approval queue (minimal)
- [x] Built-in tools (echo, web search stub, channel reply stub, approval demo)
- [x] Built-in skills (PR review, issue triage seeds)

### v2 — Capability expansion
- [x] Additional channels (Web, Discord, Teams) — Chat SDK adapters + unified **`ingest`**; **`REDIS_URL`** recommended in production for thread subscription state
- [x] OAuth + full secret lifecycle (rotation, expiration, revocation) — DB + `packages/policy-engine` + `/api/secrets*`; expiration via status + housekeeping; enforcement in `canUseTool` / tool router
- [x] Long-term vector memory — `memory_embeddings` + `@vela/memory` (embed + retrieve + compaction); wired in agent loop when enabled
- [x] Legacy “template subagent (no nesting)” — **not shipped**; dynamic child runs under v3 (see below)
- [x] Richer admin UI with observability — run list filters, per-run event timeline, secrets & MCP admin pages
- [x] MCP registry + dynamic tool discovery — `mcp_registry` / `mcp_discovered_tools`, sync API, execution via tool router with approvals

### v3 — Ecosystem & governance (OSS)
Shipping as **MIT-licensed infrastructure**: self-hosted operator tooling and community-contributed packs — not a SaaS product line.

- [x] Advanced approval workflows — `approvals` supports **`quorum_required`**, **`votes`**, **`expires_at`** (expired approvals fail the run via **`expireStaleApprovals`**), and **`POST /api/approvals/:id`** rejects only with a **non-empty reason** (`rejectApproval`)
- [x] Dynamic subagent spawning — child **`runs`** with **`parent_run_id`**, **`subagent_depth`**, **`MAX_SUBAGENT_DEPTH = 3`**, and **`subagent:`** prefix in the agent loop (**`packages/agent-runtime/src/subagent.ts`**)
- [x] Skill packs / OSS install path — **`capability_packages`** / **`capability_installs`**, **`@vela/capabilities`**, **`GET`/`POST /api/capabilities`**, admin console **`/console/skills`** (redirect from **`/console/capabilities`**). Packs bundle **skills** + tool refs; aligns conceptually with portable registries like **[skills.sh](https://skills.sh)** (SKILL.md ecosystem); deep import from that directory is not wired yet.

---

## Cloud quickstart

1. **Prerequisites:** Node 20+, pnpm 9+, a [Vercel](https://vercel.com) project linked to this repo.
2. **Neon:** Create a Postgres database (Vercel Marketplace / Neon). Set `DATABASE_URL` on the project and locally in `.env.local`.
3. **Vercel Blob:** Enable Blob and set `BLOB_READ_WRITE_TOKEN` where uploads are used.
4. **AI (optional):** Enable AI Gateway on the Vercel project and run `vercel env pull` so `VERCEL_OIDC_TOKEN` and related vars exist locally for `generateText` in the agent runtime.
5. **Migrate:** From repo root, `pnpm install` then run Drizzle migrations against `DATABASE_URL` (see `@vela/db` scripts `db:generate` / `db:migrate`).
6. **Run web:** `pnpm dev` (or deploy) — health: `GET /api/health/db`, `GET /api/health/blob`. Ingest: `POST /api/events/web` with JSON `{ "text": "hello" }`. Admin: landing `/`, UI under `/console/*` only (runs, workflows, approvals, skills, secrets, agents, MCP).
7. **Durable workflow (dev):** message starting with `workflow:` + JSON step array; continue with `POST /api/runs/:id/workflow`. Step args may include `quorumRequired`, `expiresInMinutes`, `approvalType` (see `@vela/workflow` / `approval-meta`).
8. **Secrets & MCP (v2):** `GET`/`POST /api/secrets`, `POST /api/secrets/:id/rotate`, `POST /api/secrets/:id/revoke`. `GET`/`POST /api/mcp` to sync discovered tools. Optional **`VELA_LONG_TERM_MEMORY`** / **`VELA_EMBEDDING_MODEL`** (see **`.env.example`**).
9. **Chat SDK channels:** Configure **[Chat SDK](https://chat-sdk.dev/)** env vars from **`.env.example`**: **`SLACK_BOT_TOKEN`** + **`SLACK_SIGNING_SECRET`**; **`DISCORD_BOT_TOKEN`** + **`DISCORD_PUBLIC_KEY`** + **`DISCORD_APPLICATION_ID`**; **`TEAMS_APP_ID`** + **`TEAMS_APP_PASSWORD`** (and tenant if required). Set **`REDIS_URL`** in production so subscriptions survive serverless cold starts. Endpoints: `POST /api/channels/slack/events`, `POST /api/channels/discord/interactions`, `POST /api/channels/teams/messages`. The web app lists **`discord.js`** / **`zlib-sync`** as **`serverExternalPackages`** so Turbopack can build; at runtime the Discord adapter resolves optional native deps like any Node bot.

**Env reference:** copy **`.env.example`**; for AI embeddings / long-term memory you need a working AI Gateway or provider configuration consistent with how **`packages/memory`** calls **`embed()`**.

---

## Contributing

**Product posture:** Vela is **open source under the MIT License** — meant to be forked, embedded, and operated by you. Roadmap items are capabilities for that OSS ecosystem, not a roadmap for a proprietary multi-tenant platform.

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** and **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)**. Quick checks before a PR:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build` (with `.env.local` or CI secrets for DB when applicable)

---

## License

Licensed under the **MIT License** — see [`LICENSE`](./LICENSE) for the full text. That file is what redistributors and lawyers look for; a one-line mention in the README is not a substitute.