import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat, type Adapter, type Message, type Thread } from "chat";
import type { ChannelType } from "@vela/types";
import { ingestUserMessage } from "./ingest";

function createChatState(): ReturnType<typeof createRedisState> | ReturnType<typeof createMemoryState> {
  if (process.env.REDIS_URL?.trim()) {
    return createRedisState();
  }
  return createMemoryState();
}

function adapterNameToChannel(name: string): ChannelType {
  if (name === "slack" || name === "discord" || name === "teams") {
    return name;
  }
  throw new Error(`Unsupported Chat SDK adapter: ${name}`);
}

async function ingestFromChatThread(thread: Thread, message: Message): Promise<void> {
  const text = message.text?.trim() ?? "";
  if (!text) return;
  const channel = adapterNameToChannel(thread.adapter.name);
  await ingestUserMessage({
    text,
    channel,
    channelRef: thread.id,
  });
}

/**
 * Dynamic imports keep heavy platform SDKs (e.g. discord.js) out of unrelated route bundles.
 */
async function buildAdapters(): Promise<Record<string, Adapter>> {
  const adapters: Record<string, Adapter> = {};

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
    const { createSlackAdapter } = await import("@chat-adapter/slack");
    adapters.slack = createSlackAdapter() as Adapter;
  }
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY) {
    const { createDiscordAdapter } = await import("@chat-adapter/discord");
    adapters.discord = createDiscordAdapter() as Adapter;
  }
  if (process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD) {
    const { createTeamsAdapter } = await import("@chat-adapter/teams");
    adapters.teams = createTeamsAdapter() as Adapter;
  }

  return adapters;
}

let chatSingleton: Chat | null = null;
let initPromise: Promise<Chat> | null = null;

async function initVelaChat(): Promise<Chat> {
  const adapters = await buildAdapters();
  if (Object.keys(adapters).length === 0) {
    throw new Error(
      "No Chat SDK adapters configured. Set Slack (SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET), Discord (DISCORD_BOT_TOKEN + DISCORD_PUBLIC_KEY), and/or Teams (TEAMS_APP_ID + TEAMS_APP_PASSWORD).",
    );
  }

  const bot = new Chat({
    userName: process.env.VELA_BOT_USER_NAME ?? "vela",
    adapters,
    state: createChatState(),
    dedupeTtlMs: 600_000,
  }).registerSingleton();

  bot.onNewMention(async (thread, message) => {
    await thread.subscribe();
    await ingestFromChatThread(thread, message);
  });

  bot.onNewMessage(/[\s\S]+/, async (thread, message) => {
    const sub = await thread.isSubscribed();
    if (sub) return;
    await thread.subscribe();
    await ingestFromChatThread(thread, message);
  });

  bot.onSubscribedMessage(async (thread, message) => {
    await ingestFromChatThread(thread, message);
  });

  chatSingleton = bot;
  return bot;
}

/**
 * Single [Chat SDK](https://chat-sdk.dev/) instance (multi-adapter).
 */
export async function getVelaChat(): Promise<Chat> {
  if (chatSingleton) return chatSingleton;
  if (!initPromise) {
    initPromise = initVelaChat();
  }
  return initPromise;
}

export function isChatAdapterReady(platform: "slack" | "discord" | "teams"): boolean {
  if (platform === "slack") {
    return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET);
  }
  if (platform === "discord") {
    return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY);
  }
  return Boolean(process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD);
}

export async function dispatchChatWebhook(
  platform: "slack" | "discord" | "teams",
  req: Request,
  waitUntil: (task: Promise<unknown>) => void,
): Promise<Response> {
  if (!isChatAdapterReady(platform)) {
    return new Response(
      JSON.stringify({
        error: `${platform} adapter is not configured (see README / .env.example)`,
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const chat = await getVelaChat();
  const hooks = chat.webhooks as unknown as Record<
    string,
    (request: Request, options?: { waitUntil?: (task: Promise<unknown>) => void }) => Promise<Response>
  >;
  const handler = hooks[platform];
  if (!handler) {
    return new Response(JSON.stringify({ error: `${platform} webhook not available` }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  return handler(req, { waitUntil });
}
