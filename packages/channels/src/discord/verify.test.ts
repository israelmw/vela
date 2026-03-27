import { describe, expect, it } from "vitest";
import { verifyDiscordInteraction } from "./verify";

describe("verifyDiscordInteraction", () => {
  it("rejects invalid hex signature", () => {
    expect(
      verifyDiscordInteraction(
        "{}",
        "not-hex",
        "1234567890",
        "0".repeat(64),
      ),
    ).toBe(false);
  });

  it("rejects wrong public key length", () => {
    expect(
      verifyDiscordInteraction("{}", "ab", "1234567890", "ff"),
    ).toBe(false);
  });
});
