import { describe, expect, it } from "vitest";
import {
  resolveSkillIdsFromText,
  selectTopSemanticSkills,
} from "./resolver";

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

describe("selectTopSemanticSkills", () => {
  it("returns highest similarity ids over threshold", () => {
    const picked = selectTopSemanticSkills(
      [1, 0],
      [
        { id: "a", text: "", embedding: [0.99, 0.01] },
        { id: "b", text: "", embedding: [0.1, 0.9] },
      ],
      2,
      0.2,
    );
    expect(picked).toEqual(["a"]);
  });
});
