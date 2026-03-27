import { describe, expect, it, vi } from "vitest";
import {
  expiresAtFromMinutes,
  stripApprovalToolMeta,
} from "./approval-meta";

describe("stripApprovalToolMeta", () => {
  it("passes through non-objects", () => {
    expect(stripApprovalToolMeta(null).cleanArgs).toBeNull();
    expect(stripApprovalToolMeta("x").cleanArgs).toBe("x");
  });

  it("strips approval meta and keeps tool fields", () => {
    const { cleanArgs, quorumRequired, expiresInMinutes, approvalType } =
      stripApprovalToolMeta({
        note: "hi",
        quorumRequired: 2,
        expiresInMinutes: 15,
        approvalType: "subagent_spawn",
        extra: 1,
      });
    expect(cleanArgs).toEqual({ note: "hi", extra: 1 });
    expect(quorumRequired).toBe(2);
    expect(expiresInMinutes).toBe(15);
    expect(approvalType).toBe("subagent_spawn");
  });
});

describe("expiresAtFromMinutes", () => {
  it("returns null when undefined", () => {
    expect(expiresAtFromMinutes(undefined)).toBeNull();
  });

  it("returns a future date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const d = expiresAtFromMinutes(10);
    expect(d?.toISOString()).toBe("2026-01-01T00:10:00.000Z");
    vi.useRealTimers();
  });
});
