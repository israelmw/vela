import { runAgentTurn } from "@vela/agent-runtime";
import {
  appendMessage,
  createRun,
  ensureDefaultAgent,
  getOrCreateActiveSession,
  getOrCreateThread,
} from "@vela/control-plane";
import {
  ensureDemoCapabilityPack,
  listInstalledSkillIdsForAgent,
} from "@vela/capabilities";
import { db, ensureDevCatalog, messages } from "@vela/db";
import { and, desc, eq, gt } from "drizzle-orm";
import {
  attachSkillsToRun,
  resolveSkillIdsForText,
  syncSkillsFromFilesystem,
} from "@vela/skill-resolver";
import path from "node:path";
import type { ChannelType } from "@vela/types";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { log } from "./logger";
import { maybeAutoSyncMcpTools } from "./mcp-autosync";

async function latestAssistantAfterUserMessage(
  sessionId: string,
  userCreatedAt: Date,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.sessionId, sessionId),
        eq(messages.role, "assistant"),
        gt(messages.createdAt, userCreatedAt),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (!row) return null;
  const c = row.content as { text?: unknown };
  return typeof c.text === "string" ? c.text : null;
}

export async function ingestUserMessage(input: {
  text: string;
  tenantId?: string;
  channel: ChannelType;
  channelRef: string;
  requestId?: string;
}): Promise<{
  threadId: string;
  sessionId: string;
  runId: string;
  userMessageId: string;
  assistantText?: string;
}> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const text = input.text.trim();
  if (!text) {
    throw new Error("text required");
  }

  const agent = await ensureDefaultAgent(db, tenantId);
  await ensureDevCatalog(db, { agentId: agent.id, tenantId });
  await ensureDemoCapabilityPack(db, {
    tenantId,
    agentId: agent.id,
  });
  await syncSkillsFromFilesystem(db, path.join(process.cwd(), "../.."));
  await maybeAutoSyncMcpTools(tenantId);

  const thread = await getOrCreateThread(db, {
    tenantId,
    agentId: agent.id,
    channel: input.channel,
    channelRef: input.channelRef,
  });

  const session = await getOrCreateActiveSession(db, {
    threadId: thread.id,
    agentId: agent.id,
    tenantId,
  });

  const userMsg = await appendMessage(db, {
    sessionId: session.id,
    threadId: thread.id,
    role: "user",
    content: { text },
  });

  const run = await createRun(db, {
    sessionId: session.id,
    agentId: agent.id,
    trigger: `${input.channel}.message`,
  });

  const capSkillIds = await listInstalledSkillIdsForAgent(db, {
    tenantId,
    agentId: agent.id,
  });
  const merged = await resolveSkillIdsForText(db, {
    text,
    defaultSkillIds: agent.defaultSkills,
    extraSkillIds: capSkillIds,
  });
  const defaultIds = agent.defaultSkills.filter((id) => merged.includes(id));
  const dynamicIds = merged.filter((id) => !agent.defaultSkills.includes(id));

  await attachSkillsToRun(db, {
    runId: run.id,
    skillIds: defaultIds,
    source: "default",
  });
  await attachSkillsToRun(db, {
    runId: run.id,
    skillIds: dynamicIds,
    source: "dynamic",
  });

  await runAgentTurn(
    db,
    run.id,
    input.requestId ? { requestId: input.requestId } : {},
  );

  const assistantText =
    (await latestAssistantAfterUserMessage(session.id, userMsg.createdAt)) ??
    undefined;

  log.info("ingest.completed", {
    channel: input.channel,
    tenantId,
    threadId: thread.id,
    sessionId: session.id,
    runId: run.id,
    agentId: agent.id,
  });

  const result: {
    threadId: string;
    sessionId: string;
    runId: string;
    userMessageId: string;
    assistantText?: string;
  } = {
    threadId: thread.id,
    sessionId: session.id,
    runId: run.id,
    userMessageId: userMsg.id,
  };
  if (assistantText !== undefined) {
    result.assistantText = assistantText;
  }
  return result;
}
