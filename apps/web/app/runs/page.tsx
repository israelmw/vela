import { listRecentRuns } from "@vela/control-plane";
import { db } from "@vela/db";
import Link from "next/link";

export default async function RunsPage() {
  const rows = await listRecentRuns(db, 50);

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>Runs</h1>
          <Link className="link" href="/">
            Home
          </Link>
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
