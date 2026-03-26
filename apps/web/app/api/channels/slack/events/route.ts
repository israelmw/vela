import { verifySlackRequestSignature } from "@vela/channels";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { NextResponse } from "next/server";
import { ingestUserMessage } from "../../../../../lib/ingest";

export async function POST(req: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "SLACK_SIGNING_SECRET not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const slackSignature = req.headers.get("x-slack-signature") ?? "";
  const requestTimestamp = req.headers.get("x-slack-request-timestamp") ?? "";

  const ok = verifySlackRequestSignature({
    signingSecret,
    requestTimestamp,
    rawBody,
    slackSignature,
  });

  if (!ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.type === "url_verification" && typeof payload.challenge === "string") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event || event.type !== "message") {
    return NextResponse.json({ ok: true });
  }

  const subtype = event.subtype as string | undefined;
  if (subtype && subtype !== "file_share") {
    return NextResponse.json({ ok: true });
  }

  const text = typeof event.text === "string" ? event.text : "";
  const channel = typeof event.channel === "string" ? event.channel : "unknown";
  const threadTs =
    typeof event.thread_ts === "string"
      ? event.thread_ts
      : typeof event.ts === "string"
        ? event.ts
        : `${channel}:main`;

  if (!text.trim()) {
    return NextResponse.json({ ok: true });
  }

  try {
    await ingestUserMessage({
      text,
      tenantId: DEFAULT_TENANT_ID,
      channel: "slack",
      channelRef: `${channel}:${threadTs}`,
    });
  } catch (e) {
    console.error("[slack events]", e);
  }

  return NextResponse.json({ ok: true });
}
