import type { DB } from "@vela/db";
import { runSkills, skillsRegistry } from "@vela/db";
import { and, eq } from "drizzle-orm";

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
