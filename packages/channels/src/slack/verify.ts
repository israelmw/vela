import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Slack request signatures (Events API / slash commands).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequestSignature(params: {
  signingSecret: string;
  requestTimestamp: string;
  rawBody: string;
  slackSignature: string;
}): boolean {
  if (Math.abs(Date.now() / 1000 - Number(params.requestTimestamp)) > 60 * 5) {
    return false;
  }

  const base = `v0:${params.requestTimestamp}:${params.rawBody}`;
  const hmac = createHmac("sha256", params.signingSecret)
    .update(base)
    .digest("hex");
  const expected = `v0=${hmac}`;

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(params.slackSignature, "utf8"),
    );
  } catch {
    return false;
  }
}
