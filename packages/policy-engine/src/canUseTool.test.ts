import { describe, expect, it } from "vitest";
import { canUseTool } from "./index";

/** Minimal mock of Drizzle chains used by canUseTool. */
function createSelectMock(
  sequences: Array<Array<Record<string, unknown>>>,
): {
  select: () => unknown;
} {
  let i = 0;
  return {
    select() {
      const rows = sequences[i++] ?? [];
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      };
    },
  };
}

describe("canUseTool", () => {
  it("denies unknown tool", async () => {
    const db = createSelectMock([[]]) as import("@vela/db").DB;
    const r = await canUseTool(db, {
      agentId: "a",
      tenantId: "t",
      sessionId: "s",
      toolId: "vela.echo",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("Tool not registered");
  });

  it("denies when binding missing", async () => {
    const tool = {
      id: "vela.echo",
      requiresApproval: false,
    };
    const db = createSelectMock([[tool], []]) as import("@vela/db").DB;
    const r = await canUseTool(db, {
      agentId: "a",
      tenantId: "t",
      sessionId: "s",
      toolId: "vela.echo",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("Tool not enabled for this agent/tenant");
  });

  it("allows and flags approval when tool requires it", async () => {
    const tool = {
      id: "vela.risky_change",
      requiresApproval: true,
    };
    const binding = { enabled: true };
    const db = createSelectMock([[tool], [binding]]) as import("@vela/db").DB;
    const r = await canUseTool(db, {
      agentId: "a",
      tenantId: "t",
      sessionId: "s",
      toolId: "vela.risky_change",
    });
    expect(r.allowed).toBe(true);
    expect(r.requires_approval).toBe(true);
  });

  it("allows without approval", async () => {
    const tool = {
      id: "vela.echo",
      requiresApproval: false,
    };
    const binding = { enabled: true };
    const db = createSelectMock([[tool], [binding]]) as import("@vela/db").DB;
    const r = await canUseTool(db, {
      agentId: "a",
      tenantId: "t",
      sessionId: "s",
      toolId: "vela.echo",
    });
    expect(r.allowed).toBe(true);
    expect(r.requires_approval).toBe(false);
  });
});
