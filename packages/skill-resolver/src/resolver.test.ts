import { describe, expect, it } from "vitest";
import { resolveSkillIdsFromText } from "./resolver";

describe("resolveSkillIdsFromText", () => {
  it("merges defaults with github intent", () => {
    const ids = resolveSkillIdsFromText("Please review this pr 123", [
      "base-skill",
    ]);
    expect(ids).toContain("base-skill");
    expect(ids).toContain("github-pr-review");
  });

  it("adds triage skill for triage keyword", () => {
    const ids = resolveSkillIdsFromText("Need triage on bugs", []);
    expect(ids).toContain("linear-issue-triage");
  });

  it("dedupes repeated defaults", () => {
    const ids = resolveSkillIdsFromText("hello", ["a", "a"]);
    expect(ids).toEqual(["a"]);
  });
});
