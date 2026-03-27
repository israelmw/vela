"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CapabilityActions(props: {
  packageRef: string;
  installed: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(action: "install" | "disable") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageRef: props.packageRef, action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row gap">
      {props.installed && props.enabled ? (
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => post("disable")}
        >
          Disable
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => post("install")}
        >
          {props.installed ? "Re-enable" : "Install"}
        </button>
      )}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
