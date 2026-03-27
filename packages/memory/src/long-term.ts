import { desc, eq } from "drizzle-orm";
import { embed } from "ai";
import type { DB } from "@vela/db";
import { memoryEmbeddings } from "@vela/db";

export const LONG_TERM_ENABLED =
  process.env.VELA_LONG_TERM_MEMORY === "1" ||
  process.env.VELA_LONG_TERM_MEMORY === "true";

const DEFAULT_MODEL =
  process.env.VELA_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

const MAX_VECTORS_PER_SESSION = Number(
  process.env.VELA_LONG_TERM_MAX_CHUNKS ?? "500",
);

const TOP_K = Number(process.env.VELA_LONG_TERM_TOP_K ?? "5");

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function asVector(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  for (const x of raw) {
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    out.push(x);
  }
  return out.length ? out : null;
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: DEFAULT_MODEL,
    value: text.slice(0, 8000),
  });
  return embedding;
}

/**
 * Persist a long-term memory chunk with embedding (cosine retrieval in-process).
 */
export async function storeLongTermMemory(
  db: DB,
  params: {
    sessionId: string;
    runId: string | null;
    content: string;
    meta?: unknown;
    expiresAt?: Date | null;
  },
): Promise<void> {
  const vec = await embedText(params.content);
  await db.insert(memoryEmbeddings).values({
    sessionId: params.sessionId,
    runId: params.runId,
    content: params.content.slice(0, 16_000),
    embedding: vec as unknown as object,
    meta: (params.meta ?? null) as object | null,
    expiresAt: params.expiresAt ?? null,
  });

  const rows = await db
    .select({ id: memoryEmbeddings.id })
    .from(memoryEmbeddings)
    .where(eq(memoryEmbeddings.sessionId, params.sessionId))
    .orderBy(desc(memoryEmbeddings.createdAt));

  if (rows.length > MAX_VECTORS_PER_SESSION) {
    const toDelete = rows.slice(MAX_VECTORS_PER_SESSION);
    for (const r of toDelete) {
      await db
        .delete(memoryEmbeddings)
        .where(eq(memoryEmbeddings.id, r.id));
    }
  }
}

export async function queryLongTermMemory(
  db: DB,
  params: {
    sessionId: string;
    queryText: string;
    topK?: number;
  },
): Promise<{ content: string; score: number }[]> {
  const vec = await embedText(params.queryText);
  const k = params.topK ?? TOP_K;

  const rows = await db
    .select()
    .from(memoryEmbeddings)
    .where(eq(memoryEmbeddings.sessionId, params.sessionId))
    .orderBy(desc(memoryEmbeddings.createdAt))
    .limit(200);

  const now = new Date();
  const scored: { content: string; score: number }[] = [];
  for (const r of rows) {
    if (r.expiresAt && r.expiresAt < now) continue;
    const emb = asVector(r.embedding);
    if (!emb) continue;
    const score = cosineSimilarity(vec, emb);
    scored.push({ content: r.content, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export function formatLongTermBlock(
  hits: { content: string; score: number }[],
): string {
  if (hits.length === 0) return "";
  const lines = hits.map(
    (h, i) => `${i + 1}. (sim=${h.score.toFixed(3)}) ${h.content}`,
  );
  return `Long-term memory (retrieval):\n${lines.join("\n")}`;
}
