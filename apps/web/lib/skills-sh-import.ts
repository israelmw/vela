/**
 * Import a skill from a GitHub repo using the common skills.sh / Agent Skills layout:
 * `skills/<skillId>/SKILL.md` on the default branch (main).
 *
 * @see https://skills.sh — pages link to GitHub repos and skill folders.
 */

const DEFAULT_BRANCH = "main";

function rawGithubUrl(owner: string, repo: string, path: string, branch: string) {
  const enc = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${enc}`;
}

/** Fetch SKILL.md text; throws if missing or non-OK. */
export async function fetchSkillMdFromGithub(params: {
  owner: string;
  repo: string;
  skill: string;
  branch?: string;
}): Promise<string> {
  const branch = params.branch ?? DEFAULT_BRANCH;
  const path = `skills/${params.skill}/SKILL.md`;
  const url = rawGithubUrl(params.owner, params.repo, path, branch);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Could not fetch ${url} (${res.status}). Expected skills/${params.skill}/SKILL.md on branch ${branch}.`,
    );
  }
  return res.text();
}

/** Build Vela capability manifest from SKILL.md body (instructions = full markdown). */
export function skillMarkdownToManifest(params: {
  skillId: string;
  markdown: string;
  sourceLabel: string;
}) {
  const md = params.markdown.replace(/^\uFEFF/, "");
  const lines = md.split(/\r?\n/);
  let name = params.skillId;
  const first = lines[0]?.trim() ?? "";
  const h1 = /^#\s+(.+)$/.exec(first);
  if (h1?.[1]) {
    name = h1[1].trim();
  }
  let description = "";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    if (line.startsWith("#")) break;
    description = line;
    break;
  }
  if (!description) {
    description = `Skill imported from ${params.sourceLabel}`;
  }

  const safeId = params.skillId.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "skill";

  return {
    description: `Imported from ${params.sourceLabel}`,
    skills: [
      {
        id: safeId,
        name,
        description,
        version: "1.0.0",
        instructions: md,
        requiredTools: [] as string[],
        requiredMcp: [] as string[],
        files: [] as string[],
      },
    ],
    tools: [] as string[],
  };
}

export function packRefForSkillsShImport(owner: string, repo: string, skill: string) {
  const safe = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  return `skills.sh.${safe(owner)}.${safe(repo)}.${safe(skill)}`;
}
