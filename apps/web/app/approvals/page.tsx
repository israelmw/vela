import { expireStaleApprovals } from "@vela/agent-runtime";
import { db } from "@vela/db";
import { approvals } from "@vela/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ApprovalActions } from "./approval-actions";

export default async function ApprovalsPage() {
  await expireStaleApprovals(db);
  const rows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .orderBy(desc(approvals.requestedAt));

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>Pending approvals</h1>
          <Link className="link" href="/">
            Home
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="muted">No pending approvals.</p>
        ) : (
          <ul className="list">
            {rows.map((a) => (
              <li key={a.id} className="list-item">
                <div className="row-between">
                  <div>
                    <div className="mono">{a.id}</div>
                    <div className="muted small">
                      type {a.type} · quorum {a.quorumRequired ?? 1}
                      {a.expiresAt
                        ? ` · expires ${a.expiresAt.toISOString()}`
                        : ""}
                    </div>
                    <div className="muted small">
                      run{" "}
                      <Link className="link" href={`/runs/${a.runId}`}>
                        {a.runId.slice(0, 8)}…
                      </Link>
                    </div>
                    {Array.isArray(a.votes) && a.votes.length > 0 ? (
                      <pre className="pre small">
                        votes: {JSON.stringify(a.votes, null, 2)}
                      </pre>
                    ) : null}
                    <pre className="pre small">
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  </div>
                  <ApprovalActions
                    approvalId={a.id}
                    quorumRequired={a.quorumRequired ?? 1}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
