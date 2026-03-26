export type ToolCallResult =
  | { ok: true; output: unknown }
  | {
      ok: false;
      error: string;
      code?: "denied" | "requires_approval" | "unknown_tool";
    };
