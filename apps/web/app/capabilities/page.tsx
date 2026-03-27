import { listCapabilityInstallsForAgent, listCapabilityPackages } from "@vela/capabilities";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import Link from "next/link";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { CapabilityActions } from "./capability-actions";

export default async function CapabilitiesPage() {
  const tenantId = DEFAULT_TENANT_ID;
  const agent = await ensureDefaultAgent(db, tenantId);
  const [packages, installs] = await Promise.all([
    listCapabilityPackages(db),
    listCapabilityInstallsForAgent(db, { tenantId, agentId: agent.id }),
  ]);

  const installByRef = new Map(installs.map((i) => [i.packageRef, i]));

  return (
    <main className="container wide">
      <section className="card flat">
        <div className="row-between">
          <h1>Capability packs (OSS)</h1>
          <Link className="link" href="/">
            Home
          </Link>
        </div>
        <p className="muted small">
          Registry + install state for the default agent on tenant{" "}
          <code>{tenantId}</code>.
        </p>
        {packages.length === 0 ? (
          <p className="muted">No capability packages registered.</p>
        ) : (
          <ul className="list">
            {packages.map((p) => {
              const i = installByRef.get(p.ref);
              return (
                <li key={p.id} className="list-item">
                  <div className="row-between">
                    <div>
                      <div className="mono">
                        {p.ref} @ {p.version}
                      </div>
                      <div>{p.name}</div>
                      <pre className="pre small">
                        {JSON.stringify(p.manifest, null, 2)}
                      </pre>
                      {i ? (
                        <div className="muted small">
                          Install: {i.enabled ? "enabled" : "disabled"}
                        </div>
                      ) : (
                        <div className="muted small">Not installed</div>
                      )}
                    </div>
                    <CapabilityActions
                      packageRef={p.ref}
                      enabled={i?.enabled ?? false}
                      installed={!!i}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
