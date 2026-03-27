import { after } from "next/server";
import { dispatchChatWebhook } from "../../../../../lib/chat-bot";

/**
 * Microsoft Teams / Bot Framework messaging — [Chat SDK](https://chat-sdk.dev/) Teams adapter.
 * Uses TEAMS_APP_ID, TEAMS_APP_PASSWORD (and related Teams env vars per adapter).
 */
export async function POST(req: Request) {
  try {
    return await dispatchChatWebhook("teams", req, (p) => {
      after(() => p);
    });
  } catch (e) {
    console.error("[teams messages]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
