import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Chat SDK Discord adapter pulls in discord.js + optional zlib-sync (native); keep external for Turbopack. */
  serverExternalPackages: ["discord.js", "@discordjs/ws", "zlib-sync"],
  transpilePackages: [
    "@vela/agent-runtime",
    "@chat-adapter/discord",
    "@chat-adapter/slack",
    "@chat-adapter/state-memory",
    "@chat-adapter/state-redis",
    "@chat-adapter/teams",
    "@vela/control-plane",
    "@vela/db",
    "@vela/memory",
    "@vela/policy-engine",
    "@vela/sandbox",
    "@vela/skill-resolver",
    "@vela/tool-router",
    "@vela/types",
    "@vela/workflow",
    "chat",
  ],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
