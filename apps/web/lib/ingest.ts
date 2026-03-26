import { runAgentTurn } from "@vela/agent-runtime";
import {
  appendMessage,
  createRun,
  ensureDefaultAgent,
  getOrCreateActiveSession,
  getOrCreateThread,
} from "@vela/control-plane";
import { db, ensureDevCatalog } from "@vela/db";
import {
  attachSkillsToRun,
  resolveSkillIdsFromText,
} from "@vela/skill-resolver";
import type { ChannelType } from "@vela/types";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { log } from "./logger";

export async function ingestUserMessage(input: {
  text: string;
  tenantId?: string;
  channel: ChannelType;
  channelRef: string;
}): Promise<{
  threadId: string;
  sessionId: string;
  runId: string;
  userMessageId: string;
}> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const text = input.text.trim();
  if (!text) {
    throw new Error("text required");
  }

  const agent = await ensureDefaultAgent(db, tenantId);
  await ensureDevCatalog(db, { agentId: agent.id, tenantId });

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

  const merged = resolveSkillIdsFromText(text, agent.defaultSkills);
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

  await runAgentTurn(db, run.id);

  log.info("ingest.completed", {
    channel: input.channel,
    tenantId,
    threadId: thread.id,
    sessionId: session.id,
    runId: run.id,
    agentId: agent.id,
  });

  return {
    threadId: thread.id,
    sessionId: session.id,
    runId: run.id,
    userMessageId: userMsg.id,
  };
}
