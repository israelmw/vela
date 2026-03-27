import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import { mcpDiscoveredTools, mcpRegistry } from "@vela/db";
import Link from "next/link";
import { DEFAULT_TENANT_ID } from "@vela/types";

export default async function McpPage() {
  const tenantId = DEFAULT_TENANT_ID;
  await ensureDefaultAgent(db, tenantId);
  const servers = await db.select().from(mcpRegistry);
  const discovered = await db.select().from(mcpDiscoveredTools);

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>MCP registry</h1>
          <Link className="link" href="/">
            Home
          </Link>
        </div>
        <p className="muted small">
          HTTP JSON-RPC <code>tools/list</code> discovery.{" "}
          <code>POST /api/mcp</code> body <code>{"{ \"mcpId\": \"...\" }"}</code>{" "}
          syncs tools into <code>tools_registry</code> and binds them to the
          default agent.
        </p>
        <h2>Servers</h2>
        <pre className="pre">{JSON.stringify(servers, null, 2)}</pre>
        <h2>Discovered tools</h2>
        <pre className="pre">{JSON.stringify(discovered, null, 2)}</pre>
      </section>
    </main>
  );
}
