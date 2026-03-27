import { getTeamsActivityText, teamsConversationRef } from "@vela/channels";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { NextResponse } from "next/server";
import { ingestUserMessage } from "../../../../../lib/ingest";

/**
 * Teams / Bot Framework messaging endpoint (simplified).
 * Optional: set `TEAMS_MESSAGING_SECRET` and send it as `Authorization: Bearer <secret>` for basic protection.
 */
export async function POST(req: Request) {
  const secret = process.env.TEAMS_MESSAGING_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let activity: unknown;
  try {
    activity = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const text = getTeamsActivityText(activity);
  if (!text) {
    return NextResponse.json({});
  }

  const channelRef = teamsConversationRef(activity);

  try {
    await ingestUserMessage({
      text,
      tenantId: DEFAULT_TENANT_ID,
      channel: "teams",
      channelRef,
      requestId: channelRef,
    });
  } catch (e) {
    console.error("[teams messages]", e);
  }

  return NextResponse.json({});
}
