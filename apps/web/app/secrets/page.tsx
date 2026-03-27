import { listSecretBindings } from "@vela/policy-engine";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import Link from "next/link";
import { DEFAULT_TENANT_ID } from "@vela/types";

export default async function SecretsPage() {
  const tenantId = DEFAULT_TENANT_ID;
  const agent = await ensureDefaultAgent(db, tenantId);
  const rows = await listSecretBindings(db, { tenantId, agentId: agent.id });

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>Secret bindings</h1>
          <Link className="link" href="/">
            Home
          </Link>
        </div>
        <p className="muted small">
          OSS lifecycle: <code>active</code>, <code>expired</code>,{" "}
          <code>revoked</code>. <code>secret_ref</code> names an env var or
          vault pointer resolved at runtime.
        </p>
        <p className="muted small">
          API: <code>GET/POST /api/secrets</code>,{" "}
          <code>POST /api/secrets/[id]/rotate</code>,{" "}
          <code>POST /api/secrets/[id]/revoke</code>
        </p>
        {rows.length === 0 ? (
          <p className="muted">No secret bindings.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>id</th>
                <th>provider</th>
                <th>scope</th>
                <th>status</th>
                <th>secret_ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id.slice(0, 8)}…</td>
                  <td>{r.provider}</td>
                  <td>{r.scope}</td>
                  <td>{r.status}</td>
                  <td className="mono">{r.secretRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
