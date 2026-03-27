"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";

type Secret = { id: string; provider: string; status: "active" | "expired" | "revoked"; rotatedAt: string };

function matchesFilter(text: string, q: string) {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

export default function SecretsPage() {
  const [secrets, setSecrets] = React.useState<Secret[]>([]);
  const [filter, setFilter] = React.useState("");
  React.useEffect(() => {
    fetch("/api/console/secrets", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSecrets(d.secrets ?? []))
      .catch(() => setSecrets([]));
  }, []);

  const visible = secrets.filter(
    (s) =>
      matchesFilter(s.provider, filter) ||
      matchesFilter(s.id, filter) ||
      matchesFilter(s.status, filter),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput
          placeholder="search secrets… (Enter)"
          onSubmit={(q) => setFilter(q.trim())}
        />
        {filter ? (
          <p className="font-mono text-[10px] text-[#6b7280] mt-2">
            Filter: <span className="text-[#a9b1c4]">{filter}</span>
            <button
              type="button"
              className="ml-2 text-[#52a7ff] hover:underline"
              onClick={() => setFilter("")}
            >
              clear
            </button>
          </p>
        ) : null}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6">
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Active Secret Bindings</h2>
        <div className="space-y-2 max-w-xl">
          {visible.length === 0 ? (
            <p className="font-mono text-sm text-[#6b7280]">
              {secrets.length === 0
                ? "No secret bindings."
                : "No bindings match this filter."}
            </p>
          ) : null}
          {visible.map((secret) => (
            <div key={secret.id} className="border border-[#1f2635] bg-[#0f1218] rounded p-3 flex items-center justify-between hover:border-[#52a7ff]/50 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                <StatusDot status={secret.status === "active" ? "ok" : "warn"} size="sm" />
                <div>
                  <div className="font-mono text-sm text-[#e8ecf4]">{secret.provider}</div>
                  <div className="font-mono text-xs" style={{ color: "#a9b1c4" }}>{secret.id}</div>
                </div>
              </div>
              <div className="text-xs font-mono" style={{ color: "#a9b1c4" }}>{new Date(secret.rotatedAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
