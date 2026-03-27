import nacl from "tweetnacl";

/**
 * Verify Discord Interactions request (ed25519).
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */
export function verifyDiscordInteraction(
  rawBody: string,
  signatureHex: string,
  timestamp: string,
  clientPublicKeyHex: string,
): boolean {
  try {
    const msg = new TextEncoder().encode(timestamp + rawBody);
    const sig = Uint8Array.from(Buffer.from(signatureHex, "hex"));
    const pk = Uint8Array.from(Buffer.from(clientPublicKeyHex, "hex"));
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}
