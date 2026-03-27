import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import { mcpDiscoveredTools, mcpRegistry } from "@vela/db";
import Link from "next/link";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { syncAllMcpAction } from "./actions";

export default async function McpPage() {
  const tenantId = DEFAULT_TENANT_ID;
  await ensureDefaultAgent(db, tenantId);
  const servers = await db.select().from(mcpRegistry);
  const discovered = await db.select().from(mcpDiscoveredTools);

  const toolCountByMcp = discovered.reduce<Record<string, number>>((acc, row) => {
    acc[row.mcpId] = (acc[row.mcpId] ?? 0) + 1;
    return acc;
  }, {});

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
          HTTP JSON-RPC <code>tools/list</code>.{" "}
          <strong>Event:</strong> <code>POST /api/mcp/registry</code> upserts a
          server and runs discovery immediately.{" "}
          <strong>Pull:</strong> <code>POST /api/mcp</code>{" "}
          <code>{`{ "mcpId" | "syncAll" }`}</code>, ingest throttle, or cron{" "}
          <code>/api/cron/mcp-sync</code>.{" "}
          <strong>Health/traffic:</strong> before each <code>tools/call</code>,
          stale or failed checks trigger refresh (
          <code>VELA_MCP_HEALTH_REFRESH_MS</code>); one rediscover+retry after a
          failed call.
        </p>

        <form action={syncAllMcpAction} className="nav-row" style={{ marginBottom: "1rem" }}>
          <button type="submit" className="btn">
            Sync all MCP servers now
          </button>
        </form>

        <h2>Servers</h2>
        {servers.length === 0 ? (
          <p className="muted small">No rows in <code>mcp_registry</code>.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Health</th>
                  <th>Tools</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.id}</td>
                    <td>{s.name}</td>
                    <td className="mono small">{s.url}</td>
                    <td>
                      {s.lastHealthCheck == null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className={s.lastHealthOk ? "stat-ok" : "stat-bad"}>
                          {s.lastHealthOk ? "ok" : "fail"}{" "}
                          <span className="muted small">
                            {new Date(s.lastHealthCheck).toISOString()}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="mono">{toolCountByMcp[s.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Discovered tools</h2>
        {discovered.length === 0 ? (
          <p className="muted small">None yet — run sync from above or POST /api/mcp.</p>
        ) : (
          <pre className="pre">{JSON.stringify(discovered, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
