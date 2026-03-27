import { listRunEvents } from "@vela/control-plane";
import { db } from "@vela/db";
import { approvals, runSteps, runs } from "@vela/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) notFound();

  const steps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, id))
    .orderBy(asc(runSteps.stepIndex));

  const appr = await db
    .select()
    .from(approvals)
    .where(eq(approvals.runId, id));

  const events = await listRunEvents(db, id);

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1 className="mono">Run {id}</h1>
          <Link className="link" href="/runs">
            Back
          </Link>
        </div>
        <dl className="kv">
          <dt>status</dt>
          <dd>{run.status}</dd>
          <dt>trigger</dt>
          <dd>{run.trigger}</dd>
          <dt>summary</dt>
          <dd>{run.resultSummary ?? "—"}</dd>
          <dt>error</dt>
          <dd className="error">{run.error ?? "—"}</dd>
        </dl>

        <h2>Steps</h2>
        <pre className="pre">{JSON.stringify(steps, null, 2)}</pre>

        <h2>Approvals</h2>
        <pre className="pre">{JSON.stringify(appr, null, 2)}</pre>

        <h2>Run events (observability)</h2>
        {events.length === 0 ? (
          <p className="muted">No persisted events for this run.</p>
        ) : (
          <ul className="list">
            {events.map((ev) => (
              <li key={ev.id} className="list-item">
                <div className="muted small">
                  {ev.createdAt.toISOString()} · {ev.level} · {ev.eventType}
                  {ev.requestId ? ` · req ${ev.requestId}` : ""}
                </div>
                <div>{ev.message}</div>
                {ev.meta ? (
                  <pre className="pre small">
                    {JSON.stringify(ev.meta, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
