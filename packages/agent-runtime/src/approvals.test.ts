import { describe, expect, it } from "vitest";
import { parseVotes } from "./approvals";

describe("parseVotes", () => {
  it("filters invalid entries", () => {
    expect(parseVotes(null)).toEqual([]);
    expect(parseVotes([{ foo: 1 }])).toEqual([]);
  });

  it("keeps approve and reject votes", () => {
    const v = parseVotes([
      { actor: "a", action: "approve", at: "2026-01-01T00:00:00Z" },
      {
        actor: "b",
        action: "reject",
        at: "2026-01-01T00:01:00Z",
        reason: "no",
      },
    ]);
    expect(v).toHaveLength(2);
    expect(v[1]!.reason).toBe("no");
  });
});
