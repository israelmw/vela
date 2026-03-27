import { describe, expect, it } from "vitest";
import { parseCapabilityManifest } from "./manifest";

describe("parseCapabilityManifest", () => {
  it("returns empty skills for invalid input", () => {
    expect(parseCapabilityManifest(null)).toEqual({ skills: [] });
    expect(parseCapabilityManifest([])).toEqual({ skills: [] });
  });

  it("parses embedded skills", () => {
    const m = parseCapabilityManifest({
      description: "Pack",
      skills: [
        {
          id: "s1",
          name: "Skill one",
          description: "d",
          version: "1.0.0",
          instructions: "do",
          requiredTools: ["vela.echo"],
        },
      ],
      tools: ["vela.echo"],
    });
    expect(m.description).toBe("Pack");
    expect(m.skills).toHaveLength(1);
    expect(m.skills[0]!.id).toBe("s1");
    expect(m.skills[0]!.requiredTools).toEqual(["vela.echo"]);
    expect(m.tools).toEqual(["vela.echo"]);
  });
});
