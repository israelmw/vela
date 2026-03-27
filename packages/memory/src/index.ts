import { desc, eq } from "drizzle-orm";
import type { DB } from "@vela/db";
import { messages, workingMemory } from "@vela/db";

export type { SessionStatus } from "@vela/types";

export { messages, sessions, workingMemory } from "@vela/db";

/** Max messages loaded into prompt context (short-term). */
export const SHORT_TERM_DEFAULT_LIMIT = Number(
  process.env.VELA_SHORT_TERM_MESSAGE_LIMIT ?? "50",
);

/** Recent user/assistant messages as plain text (oldest first). */
export async function loadShortTermTranscript(
  db: DB,
  sessionId: string,
  limit: number = SHORT_TERM_DEFAULT_LIMIT,
): Promise<string> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.createdAt))
    .limit(Math.max(1, limit));

  rows.reverse();
  return rows
    .map((m) => {
      const c = m.content as { text?: string } | string;
      const body = typeof c === "string" ? c : (c.text ?? JSON.stringify(c));
      return `${m.role}: ${body}`;
    })
    .join("\n");
}

/** Working-memory key/value map for the session. */
export async function listWorkingMemory(
  db: DB,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(workingMemory)
    .where(eq(workingMemory.sessionId, sessionId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function upsertWorkingMemory(
  db: DB,
  params: {
    sessionId: string;
    key: string;
    value: unknown;
  },
): Promise<void> {
  const v = params.value as object;
  await db
    .insert(workingMemory)
    .values({
      sessionId: params.sessionId,
      key: params.key,
      value: v,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [workingMemory.sessionId, workingMemory.key],
      set: {
        value: v,
        updatedAt: new Date(),
      },
    });
}

/** Append a compact block for the model (facts / scratch). */
export function formatWorkingMemoryBlock(kv: Record<string, unknown>): string {
  if (Object.keys(kv).length === 0) return "";
  return `Working memory:\n${JSON.stringify(kv, null, 2)}`;
}

export {
  LONG_TERM_ENABLED,
  embedText,
  formatLongTermBlock,
  queryLongTermMemory,
  storeLongTermMemory,
} from "./long-term";
