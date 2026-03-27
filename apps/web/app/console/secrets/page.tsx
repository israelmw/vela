"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";

type Secret = { id: string; provider: string; status: "active" | "expired" | "revoked"; rotatedAt: string };

export default function SecretsPage() {
  const [secrets, setSecrets] = React.useState<Secret[]>([]);
  React.useEffect(() => {
    fetch("/api/console/secrets", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSecrets(d.secrets ?? []))
      .catch(() => setSecrets([]));
  }, []);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput placeholder="search secrets..." />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6">
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Active Secret Bindings</h2>
        <div className="space-y-2 max-w-xl">
          {secrets.map((secret) => (
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
