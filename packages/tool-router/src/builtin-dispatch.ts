import type { ToolCallResult } from "./types";

export function dispatchBuiltin(
  toolId: string,
  args: unknown,
): ToolCallResult {
  switch (toolId) {
    case "vela.echo":
      return { ok: true, output: { echoed: args } };
    case "vela.web_search_stub":
      return {
        ok: true,
        output: { query: args, results: [], note: "stub" },
      };
    case "vela.channel_reply_stub":
      return {
        ok: true,
        output: {
          channel: "stub",
          delivered: true,
          payload: args,
        },
      };
    case "vela.risky_change":
      return {
        ok: true,
        output: { applied: true, note: "simulated after approval" },
      };
    default:
      return {
        ok: false,
        error: `No builtin handler for tool: ${toolId}`,
        code: "unknown_tool",
      };
  }
}
