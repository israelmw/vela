import {
  ensureDefaultAgent,
  getOrCreateActiveSession,
  getOrCreateThread,
} from "@vela/control-plane";
import { db, messages } from "@vela/db";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

/** Transcript for the web console thread (user + assistant messages). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channelRef = searchParams.get("channelRef") ?? "vela-console";
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;

  const agent = await ensureDefaultAgent(db, tenantId);
  const thread = await getOrCreateThread(db, {
    tenantId,
    agentId: agent.id,
    channel: "web",
    channelRef,
  });
  const session = await getOrCreateActiveSession(db, {
    threadId: thread.id,
    agentId: agent.id,
    tenantId,
  });

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, session.id))
    .orderBy(asc(messages.createdAt))
    .limit(200);

  const out = rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const c = m.content as { text?: unknown };
      const text =
        typeof c.text === "string"
          ? c.text
          : typeof c.text === "number"
            ? String(c.text)
            : "";
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        text,
        createdAt: m.createdAt.toISOString(),
      };
    });

  return NextResponse.json({
    messages: out,
    threadId: thread.id,
    sessionId: session.id,
  });
}
