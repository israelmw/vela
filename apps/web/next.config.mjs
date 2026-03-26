import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@vela/agent-runtime",
    "@vela/channels",
    "@vela/control-plane",
    "@vela/db",
    "@vela/memory",
    "@vela/policy-engine",
    "@vela/sandbox",
    "@vela/skill-resolver",
    "@vela/tool-router",
    "@vela/types",
    "@vela/workflow",
  ],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
