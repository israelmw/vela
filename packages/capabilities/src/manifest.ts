import type { CapabilityManifestSkill } from "@vela/types";

export type ParsedCapabilityManifest = {
  description?: string;
  skills: CapabilityManifestSkill[];
  tools?: string[];
};

export function parseCapabilityManifest(raw: unknown): ParsedCapabilityManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { skills: [] };
  }
  const o = raw as Record<string, unknown>;
  const skills: CapabilityManifestSkill[] = [];
  if (Array.isArray(o.skills)) {
    for (const s of o.skills) {
      if (!s || typeof s !== "object") continue;
      const r = s as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      skills.push({
        id: r.id,
        name: typeof r.name === "string" ? r.name : r.id,
        description: typeof r.description === "string" ? r.description : "",
        version: typeof r.version === "string" ? r.version : "0.0.1",
        instructions:
          typeof r.instructions === "string" ? r.instructions : "",
        requiredTools: Array.isArray(r.requiredTools)
          ? r.requiredTools.filter((x): x is string => typeof x === "string")
          : [],
        requiredMcp: Array.isArray(r.requiredMcp)
          ? r.requiredMcp.filter((x): x is string => typeof x === "string")
          : [],
        files: Array.isArray(r.files)
          ? r.files.filter((x): x is string => typeof x === "string")
          : [],
      });
    }
  }
  const tools = Array.isArray(o.tools)
    ? o.tools.filter((x): x is string => typeof x === "string")
    : undefined;
  const description =
    typeof o.description === "string" ? o.description : undefined;

  const result: ParsedCapabilityManifest = { skills };
  if (tools !== undefined) {
    result.tools = tools;
  }
  if (description !== undefined) {
    result.description = description;
  }
  return result;
}
