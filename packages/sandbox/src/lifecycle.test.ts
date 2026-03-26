import { describe, expect, it } from "vitest";
import { executeSandboxOperation } from "./lifecycle";

describe("executeSandboxOperation", () => {
  it("echo returns payload", async () => {
    const r = await executeSandboxOperation(
      { id: "x", runId: "r", status: "ready" },
      { kind: "echo", payload: { a: 1 } },
    );
    expect(r.output).toEqual({ a: 1 });
  });

  it("add sums numbers", async () => {
    const r = await executeSandboxOperation(
      { id: "x", runId: "r", status: "ready" },
      { kind: "add", payload: { a: 2, b: 3 } },
    );
    expect(r.output).toBe(5);
  });
});
