import type { DB } from "@vela/db";
import { runSkills, skillsRegistry } from "@vela/db";
import { and, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { embed } from "ai";

/** Keyword-based intent routing (replace with embedding search later). */
export function resolveSkillIdsFromText(
  userText: string,
  defaultSkillIds: string[],
): string[] {
  const lower = userText.toLowerCase();
  const dynamic: string[] = [];

  if (
    lower.includes("github") ||
    lower.includes("pull request") ||
    lower.includes("pr ")
  ) {
    dynamic.push("github-pr-review");
  }
  if (lower.includes("linear") || lower.includes("triage")) {
    dynamic.push("linear-issue-triage");
  }

  return [...new Set([...defaultSkillIds, ...dynamic])];
}

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

type SkillCandidate = {
  id: string;
  text: string;
};

export function selectTopSemanticSkills(
  queryEmbedding: number[],
  skills: Array<SkillCandidate & { embedding: number[] }>,
  topK: number,
  minScore: number,
): string[] {
  return skills
    .map((s) => ({ id: s.id, score: cosineSimilarity(queryEmbedding, s.embedding) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.id);
}

const SKILL_EMBEDDING_MODEL =
  process.env.VELA_SKILL_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
const SKILL_TOP_K = Number(process.env.VELA_SKILL_TOP_K ?? "3");
const SKILL_MIN_SCORE = Number(process.env.VELA_SKILL_MIN_SCORE ?? "0.24");
const SKILL_SEMANTIC_ENABLED =
  process.env.VELA_SKILL_SEMANTIC !== "0" &&
  process.env.VELA_SKILL_SEMANTIC !== "false";

const skillEmbeddingCache = new Map<string, { sig: string; vec: number[] }>();

async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: SKILL_EMBEDDING_MODEL,
    value: text.slice(0, 8000),
  });
  return embedding;
}

async function resolveSemanticSkillIds(
  db: DB,
  userText: string,
): Promise<string[]> {
  if (!SKILL_SEMANTIC_ENABLED) return [];

  const rows = await db
    .select({
      id: skillsRegistry.id,
      name: skillsRegistry.name,
      description: skillsRegistry.description,
      instructions: skillsRegistry.instructions,
    })
    .from(skillsRegistry);
  if (rows.length === 0) return [];

  const queryEmbedding = await embedText(userText);
  const prepared: Array<SkillCandidate & { embedding: number[] }> = [];

  for (const r of rows) {
    const text = `${r.name}\n${r.description}\n${r.instructions.slice(0, 2000)}`;
    const sig = `${r.name.length}:${r.description.length}:${r.instructions.length}`;
    const cached = skillEmbeddingCache.get(r.id);
    if (cached && cached.sig === sig) {
      prepared.push({ id: r.id, text, embedding: cached.vec });
      continue;
    }
    const vec = await embedText(text);
    skillEmbeddingCache.set(r.id, { sig, vec });
    prepared.push({ id: r.id, text, embedding: vec });
  }

  return selectTopSemanticSkills(
    queryEmbedding,
    prepared,
    SKILL_TOP_K,
    SKILL_MIN_SCORE,
  );
}

/**
 * Hybrid skill resolution:
 * - defaults
 * - keyword heuristics
 * - semantic similarity over skills_registry metadata
 */
export async function resolveSkillIdsForText(
  db: DB,
  params: {
    text: string;
    defaultSkillIds: string[];
    extraSkillIds?: string[];
  },
): Promise<string[]> {
  const keyword = resolveSkillIdsFromText(params.text, params.defaultSkillIds);
  let semantic: string[] = [];
  try {
    semantic = await resolveSemanticSkillIds(db, params.text);
  } catch {
    semantic = [];
  }
  return [
    ...new Set([
      ...params.defaultSkillIds,
      ...keyword,
      ...semantic,
      ...(params.extraSkillIds ?? []),
    ]),
  ];
}

export async function attachSkillsToRun(
  db: DB,
  params: { runId: string; skillIds: string[]; source?: "default" | "dynamic" },
): Promise<void> {
  const source = params.source ?? "dynamic";

  for (const skillId of params.skillIds) {
    const [row] = await db
      .select({ id: skillsRegistry.id })
      .from(skillsRegistry)
      .where(eq(skillsRegistry.id, skillId))
      .limit(1);

    if (!row) continue;

    const [exists] = await db
      .select({ id: runSkills.id })
      .from(runSkills)
      .where(
        and(
          eq(runSkills.runId, params.runId),
          eq(runSkills.skillId, skillId),
        ),
      )
      .limit(1);

    if (exists) continue;

    await db.insert(runSkills).values({
      runId: params.runId,
      skillId,
      source,
    });
  }
}

type SkillDoc = {
  id: string;
  name: string;
  description: string;
  version: string;
  instructions: string;
  requiredTools: string[];
  requiredMcp: string[];
  files: string[];
};

function parseFrontmatterList(block: string, key: string): string[] {
  const pattern = "^" + key + ":\\s*\\[(.*?)\\]\\s*$";
  const m = block.match(new RegExp(pattern, "m"));
  if (!m) return [];
  return m[1]!
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseSkillMarkdown(id: string, raw: string): SkillDoc {
  const frontmatter = raw.startsWith("---")
    ? raw.slice(3, raw.indexOf("\n---", 3) > 0 ? raw.indexOf("\n---", 3) : 3)
    : "";
  const heading =
    raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
    id
      .split("-")
      .map((x) => x.slice(0, 1).toUpperCase() + x.slice(1))
      .join(" ");
  const description =
    frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ??
    raw.match(/^>\s*(.+)$/m)?.[1]?.trim() ??
    "Skill loaded from filesystem.";
  const version =
    frontmatter.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? "0.0.1";
  const requiredTools = parseFrontmatterList(frontmatter, "required_tools");
  const requiredMcp = parseFrontmatterList(frontmatter, "required_mcp");
  const instructions = raw.trim().slice(0, 12_000);

  return {
    id,
    name: heading,
    description,
    version,
    instructions,
    requiredTools,
    requiredMcp,
    files: [],
  };
}

/** Autodiscover local skill docs and upsert to DB. */
export async function syncSkillsFromFilesystem(
  db: DB,
  rootDir: string,
): Promise<number> {
  const skillsDir = path.join(rootDir, "skills");
  let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillId = entry.name;
    const file = path.join(skillsDir, skillId, "SKILL.md");
    let raw = "";
    try {
      raw = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const doc = parseSkillMarkdown(skillId, raw);
    await db
      .insert(skillsRegistry)
      .values(doc)
      .onConflictDoUpdate({
        target: skillsRegistry.id,
        set: {
          name: doc.name,
          description: doc.description,
          version: doc.version,
          instructions: doc.instructions,
          requiredTools: doc.requiredTools,
          requiredMcp: doc.requiredMcp,
          files: doc.files,
        },
      });
    count++;
  }
  return count;
}
