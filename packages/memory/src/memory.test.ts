import { describe, expect, it } from "vitest";
import { formatWorkingMemoryBlock } from "./index";

describe("formatWorkingMemoryBlock", () => {
  it("returns empty string for empty map", () => {
    expect(formatWorkingMemoryBlock({})).toBe("");
  });

  it("renders JSON block", () => {
    const s = formatWorkingMemoryBlock({ topic: "bugs" });
    expect(s).toContain("Working memory:");
    expect(s).toContain("bugs");
  });
});
