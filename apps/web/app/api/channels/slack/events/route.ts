import { after } from "next/server";
import { dispatchChatWebhook } from "../../../../../lib/chat-bot";

/**
 * Slack Events API — delegated to [Vercel Chat SDK](https://chat-sdk.dev/) Slack adapter.
 * Requires SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET. Optional: REDIS_URL for subscriptions across instances.
 */
export async function POST(req: Request) {
  try {
    return await dispatchChatWebhook("slack", req, (p) => {
      after(() => p);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("No Chat SDK adapters")) {
      return new Response(JSON.stringify({ error: msg }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("[slack events]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
