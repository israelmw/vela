import { canUseTool, toolsRegistry } from "@vela/tool-router";
import { skillsRegistry } from "@vela/skill-resolver";
import { sessions } from "@vela/memory";
import type { RunStatus } from "@vela/types";

export type { RunStatus };

/** Wire-check stub: real loop lands in `packages/agent-runtime/src/loop`. */
export const agentRuntimeStub = {
  skillsRegistry,
  toolsRegistry,
  canUseTool,
  sessions,
};
