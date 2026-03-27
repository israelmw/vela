import { countRuns } from "@vela/control-plane";
import { db } from "@vela/db";
import { sql } from "drizzle-orm";
import { PostMessageForm } from "./components/post-message-form";

export default async function HomePage() {
  let databaseUp = false;
  try {
    await db.execute(sql`select 1 as v`);
    databaseUp = true;
  } catch {
    databaseUp = false;
  }

  const runTotal = databaseUp ? await countRuns(db) : 0;
  const blobOk = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return (
    <main className="container">
      <section className="card">
        <p className="eyebrow">Vela</p>
        <h1>Control plane for durable agent systems</h1>
        <p className="lede">
          Admin surface + API for threads, sessions, runs, skills, and approvals.
        </p>

        <ul className="stats">
          <li>
            <span className="stat-label">Database</span>
            <span
              className={databaseUp ? "stat-ok" : "stat-bad"}
              data-testid="health-db"
            >
              {databaseUp ? "connected" : "unreachable"}
            </span>
          </li>
          <li>
            <span className="stat-label">Blob token</span>
            <span className={blobOk ? "stat-ok" : "stat-warn"}>
              {blobOk ? "configured" : "missing"}
            </span>
          </li>
          <li>
            <span className="stat-label">Runs (total)</span>
            <span className="mono">{runTotal}</span>
          </li>
        </ul>

        <nav className="nav-row">
          <a className="link" href="/runs">
            All runs
          </a>
          <a className="link" href="/approvals">
            Approvals
          </a>
          <a className="link" href="/capabilities">
            Capabilities
          </a>
          <a className="link" href="/secrets">
            Secrets
          </a>
          <a className="link" href="/mcp">
            MCP
          </a>
          <a className="link" href="/api/health/db">
            Health JSON
          </a>
        </nav>

        <PostMessageForm />
      </section>
    </main>
  );
}
