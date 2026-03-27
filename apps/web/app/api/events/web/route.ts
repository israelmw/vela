import { DEFAULT_TENANT_ID } from "@vela/types";
import { NextResponse } from "next/server";
import { ingestUserMessage } from "../../../../lib/ingest";
import { log } from "../../../../lib/logger";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      tenantId?: string;
      channelRef?: string;
    };
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const tenantId =
      typeof body.tenantId === "string" ? body.tenantId : DEFAULT_TENANT_ID;
    const channelRef =
      typeof body.channelRef === "string" ? body.channelRef : "default-web";

    const requestId =
      req.headers.get("x-request-id") ??
      req.headers.get("X-Request-Id") ??
      crypto.randomUUID();

    const result = await ingestUserMessage({
      text,
      tenantId,
      channel: "web",
      channelRef,
      requestId,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("api.events.web.failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
