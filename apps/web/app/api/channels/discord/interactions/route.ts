import { verifyDiscordInteraction } from "@vela/channels";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { NextResponse } from "next/server";
import { ingestUserMessage } from "../../../../../lib/ingest";

/**
 * Discord Interactions endpoint (slash commands).
 * Configure `DISCORD_PUBLIC_KEY`. Slash command should expose a string option
 * (e.g. `text`) or we join all option values.
 */
export async function POST(req: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "DISCORD_PUBLIC_KEY not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  const ok = verifyDiscordInteraction(rawBody, signature, timestamp, publicKey);
  if (!ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (body.type !== 2) {
    return NextResponse.json({ type: 4, data: { content: "Unsupported interaction." } });
  }

  const data = body.data as Record<string, unknown> | undefined;
  const options = (data?.options as Array<{ name?: string; value?: string }>) ?? [];
  const text = options.map((o) => o.value ?? "").join(" ").trim();
  const interactionId = typeof body.id === "string" ? body.id : "unknown";

  if (!text) {
    return NextResponse.json({
      type: 4,
      data: { content: "Missing text option." },
    });
  }

  try {
    await ingestUserMessage({
      text,
      tenantId: DEFAULT_TENANT_ID,
      channel: "discord",
      channelRef: `interaction:${interactionId}`,
      requestId: interactionId,
    });
  } catch (e) {
    console.error("[discord interactions]", e);
    return NextResponse.json({
      type: 4,
      data: {
        content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      },
    });
  }

  return NextResponse.json({
    type: 4,
    data: { content: "Vela processed your request." },
  });
}
