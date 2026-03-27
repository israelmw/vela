import { after } from "next/server";
import { dispatchChatWebhook } from "../../../../../lib/chat-bot";

/**
 * Discord Interactions — [Chat SDK](https://chat-sdk.dev/) adapter (`DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`).
 */
export async function POST(req: Request) {
  try {
    return await dispatchChatWebhook("discord", req, (p) => {
      after(() => p);
    });
  } catch (e) {
    console.error("[discord interactions]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
