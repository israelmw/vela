import { describe, expect, it } from "vitest";
import { dispatchBuiltin } from "./builtin-dispatch";

describe("dispatchBuiltin", () => {
  it("echos args", () => {
    const r = dispatchBuiltin("vela.echo", { x: 1 });
    expect(r).toEqual({ ok: true, output: { echoed: { x: 1 } } });
  });

  it("returns stub search", () => {
    const r = dispatchBuiltin("vela.web_search_stub", "q");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toMatchObject({ query: "q", note: "stub" });
  });

  it("unknown tool", () => {
    const r = dispatchBuiltin("vela.nope", {});
    expect(r).toEqual({
      ok: false,
      error: "No builtin handler for tool: vela.nope",
      code: "unknown_tool",
    });
  });
});
