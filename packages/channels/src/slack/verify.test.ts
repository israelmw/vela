import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackRequestSignature } from "./verify";

describe("verifySlackRequestSignature", () => {
  it("accepts a valid v0 signature", () => {
    const signingSecret = "shhh";
    const rawBody = '{"type":"event_callback"}';
    const requestTimestamp = String(Math.floor(Date.now() / 1000));
    const base = `v0:${requestTimestamp}:${rawBody}`;
    const slackSignature =
      "v0=" +
      createHmac("sha256", signingSecret).update(base).digest("hex");

    expect(
      verifySlackRequestSignature({
        signingSecret,
        requestTimestamp,
        rawBody,
        slackSignature,
      }),
    ).toBe(true);
  });

  it("rejects wrong signature", () => {
    const requestTimestamp = String(Math.floor(Date.now() / 1000));
    expect(
      verifySlackRequestSignature({
        signingSecret: "a",
        requestTimestamp,
        rawBody: "{}",
        slackSignature: "v0=deadbeef",
      }),
    ).toBe(false);
  });

  it("rejects stale timestamp", () => {
    const signingSecret = "shhh";
    const rawBody = "{}";
    const requestTimestamp = String(Math.floor(Date.now() / 1000) - 99999);
    const base = `v0:${requestTimestamp}:${rawBody}`;
    const slackSignature =
      "v0=" +
      createHmac("sha256", signingSecret).update(base).digest("hex");

    expect(
      verifySlackRequestSignature({
        signingSecret,
        requestTimestamp,
        rawBody,
        slackSignature,
      }),
    ).toBe(false);
  });
});
