import { and, eq } from "drizzle-orm";
import type { DB } from "./client";
import {
  skillsRegistry,
  toolBindings,
  toolsRegistry,
} from "./schema";

const emptyInputSchema = {
  type: "object",
  properties: {},
} as const;

const sandboxInputSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["echo", "add"] },
    payload: { type: "object" },
  },
  required: ["kind"],
} as const;

/**
 * Idempotent dev/prod bootstrap: registry rows + bindings for the default agent.
 * Safe to call on every web request in early versions (cheap conflict no-ops).
 */
export async function ensureDevCatalog(
  db: DB,
  params: { agentId: string; tenantId: string },
): Promise<void> {
  await db
    .insert(toolsRegistry)
    .values([
      {
        id: "vela.echo",
        name: "Echo",
        description: "Return args for debugging.",
        inputSchema: emptyInputSchema,
        executorType: "builtin",
        executorRef: "vela.echo",
        requiresApproval: false,
        scope: "internal:debug",
      },
      {
        id: "vela.web_search_stub",
        name: "Web search (stub)",
        description: "Placeholder web search.",
        inputSchema: emptyInputSchema,
        executorType: "builtin",
        executorRef: "vela.web_search_stub",
        requiresApproval: false,
        scope: "web:read",
      },
      {
        id: "vela.channel_reply_stub",
        name: "Channel reply (stub)",
        description: "Placeholder outbound channel message.",
        inputSchema: emptyInputSchema,
        executorType: "builtin",
        executorRef: "vela.channel_reply_stub",
        requiresApproval: false,
        scope: "channel:write",
      },
      {
        id: "vela.risky_change",
        name: "Risky change (approval demo)",
        description: "Always requires human approval.",
        inputSchema: emptyInputSchema,
        executorType: "builtin",
        executorRef: "vela.risky_change",
        requiresApproval: true,
        scope: "internal:risk",
      },
      {
        id: "vela.sandbox",
        name: "Sandbox (ephemeral ops)",
        description:
          "Run allowlisted sandbox ops for this run: kind echo (returns payload) or add (numeric a+b). Snapshots to Blob when configured.",
        inputSchema: sandboxInputSchema,
        executorType: "builtin",
        executorRef: "vela.sandbox",
        requiresApproval: false,
        scope: "sandbox:execute",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(skillsRegistry)
    .values([
      {
        id: "github-pr-review",
        name: "GitHub PR review",
        description: "Review pull requests with structured output.",
        version: "0.0.1",
        instructions:
          "When reviewing a PR, fetch context, list risks, and suggest tests. " +
          "Vela does not install a GitHub App: any GitHub API use relies on credentials the operator stores under Vela Secrets (provider such as `github`, e.g. a PAT or fine-grained token from GitHub). " +
          "If the user lacks access, tell them to add that token via /console/secrets—not to configure a fictional Vela GitHub App.",
        files: [],
        requiredTools: ["vela.web_search_stub"],
        requiredMcp: [],
      },
      {
        id: "linear-issue-triage",
        name: "Linear issue triage",
        description: "Classify and route issues.",
        version: "0.0.1",
        instructions:
          "Parse the issue, assign priority, and suggest next actions.",
        files: [],
        requiredTools: ["vela.echo"],
        requiredMcp: [],
      },
    ])
    .onConflictDoNothing();

  const toolIds = [
    "vela.echo",
    "vela.web_search_stub",
    "vela.channel_reply_stub",
    "vela.risky_change",
    "vela.sandbox",
  ] as const;

  for (const toolId of toolIds) {
    const [existing] = await db
      .select({ id: toolBindings.id })
      .from(toolBindings)
      .where(
        and(
          eq(toolBindings.agentId, params.agentId),
          eq(toolBindings.tenantId, params.tenantId),
          eq(toolBindings.toolId, toolId),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(toolBindings).values({
        agentId: params.agentId,
        tenantId: params.tenantId,
        toolId,
        enabled: true,
      });
    }
  }
}
