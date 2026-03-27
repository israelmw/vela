import { listRecentRuns } from "@vela/control-plane";
import { db } from "@vela/db";
import type { runs } from "@vela/db";
import Link from "next/link";

type RunStatus = (typeof runs.$inferSelect)["status"];

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const st = sp.status;
  const statusFilter =
    st &&
    [
      "pending",
      "running",
      "awaiting_approval",
      "completed",
      "failed",
      "cancelled",
    ].includes(st)
      ? (st as RunStatus)
      : undefined;

  const rows = await listRecentRuns(db, 50, statusFilter);

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>Runs</h1>
          <div className="row gap">
            <Link className="link" href="/runs">
              All
            </Link>
            <Link className="link muted small" href="/runs?status=running">
              running
            </Link>
            <Link className="link muted small" href="/runs?status=failed">
              failed
            </Link>
            <Link className="link muted small" href="/runs?status=completed">
              completed
            </Link>
            <Link className="link" href="/">
              Home
            </Link>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>id</th>
              <th>status</th>
              <th>trigger</th>
              <th>started</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No runs yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/runs/${r.id}`} className="link">
                      {r.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{r.status}</td>
                  <td>{r.trigger}</td>
                  <td className="muted">{r.startedAt.toISOString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
