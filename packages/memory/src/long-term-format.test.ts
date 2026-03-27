import { describe, expect, it } from "vitest";
import { formatLongTermBlock } from "./long-term";

describe("formatLongTermBlock", () => {
  it("returns empty string when no hits", () => {
    expect(formatLongTermBlock([])).toBe("");
  });

  it("renders numbered lines with similarity", () => {
    const s = formatLongTermBlock([
      { content: "remember the vault", score: 0.9123 },
      { content: "rotation policy", score: 0.5 },
    ]);
    expect(s).toContain("Long-term memory (retrieval):");
    expect(s).toContain("1. (sim=0.912)");
    expect(s).toContain("remember the vault");
    expect(s).toContain("rotation policy");
  });
});
