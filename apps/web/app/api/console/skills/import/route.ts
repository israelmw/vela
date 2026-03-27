import {
  installCapabilityForAgent,
  upsertCapabilityPackage,
} from "@vela/capabilities";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";
import {
  fetchSkillMdFromGithub,
  packRefForSkillsShImport,
  skillMarkdownToManifest,
} from "../../../../../lib/skills-sh-import";

/**
 * Import a skill from GitHub using skills.sh layout: `skills/<skill>/SKILL.md`.
 * Equivalent ecosystem path to: `npx skills add https://github.com/{owner}/{repo} --skill {skill}`
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    owner?: string;
    repo?: string;
    skill?: string;
    branch?: string;
  };

  const owner = body.owner?.trim();
  const repo = body.repo?.trim();
  const skill = body.skill?.trim();
  if (!owner || !repo || !skill) {
    return NextResponse.json(
      { error: "owner, repo, and skill are required (GitHub coordinates)" },
      { status: 400 },
    );
  }

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;

  try {
    const mdParams: { owner: string; repo: string; skill: string; branch?: string } = {
      owner,
      repo,
      skill,
    };
    if (body.branch !== undefined && body.branch !== "") {
      mdParams.branch = body.branch.trim();
    }
    const markdown = await fetchSkillMdFromGithub(mdParams);
    const ref = packRefForSkillsShImport(owner, repo, skill);
    const manifest = skillMarkdownToManifest({
      skillId: skill,
      markdown,
      sourceLabel: `skills.sh / ${owner}/${repo} / ${skill}`,
    });

    const version = "1.0.0";
    const name = `${skill} (${owner}/${repo})`;

    await upsertCapabilityPackage(db, {
      ref,
      name,
      version,
      manifest,
      source: `github:${owner}/${repo}#skills/${skill}`,
    });

    const agent = await ensureDefaultAgent(db, tenantId);
    await installCapabilityForAgent(db, {
      tenantId,
      agentId: agent.id,
      packageRef: ref,
    });

    return NextResponse.json({
      ok: true,
      ref,
      name,
      version,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
