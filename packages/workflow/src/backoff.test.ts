import { describe, expect, it } from "vitest";
import { computeRetryDelayMs } from "./backoff";

describe("computeRetryDelayMs", () => {
  it("grows exponentially and caps", () => {
    expect(computeRetryDelayMs(0)).toBe(1000);
    expect(computeRetryDelayMs(1)).toBe(2000);
    expect(computeRetryDelayMs(10)).toBe(60_000);
  });
});
