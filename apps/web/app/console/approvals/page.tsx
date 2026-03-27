"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, MonoBadge } from "../../components/vela";

type Approval = { id: string; type: string; description: string; requestedAt: string };

export default function ApprovalsPage() {
  const [items, setItems] = React.useState<Approval[]>([]);
  React.useEffect(() => {
    fetch("/api/console/approvals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.approvals ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput placeholder="filter approvals..." />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6">
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Pending Approvals</h2>
        <div className="space-y-3 max-w-2xl">
          {items.map((approval) => (
            <div key={approval.id} className="border border-[#fcd34d] bg-[#fcd34d]/10 rounded-lg p-4">
              <div className="font-mono text-sm text-[#e8ecf4] mb-1">{approval.description}</div>
              <div className="flex items-center gap-2">
                <MonoBadge variant="warn">{approval.type}</MonoBadge>
                <span className="font-mono text-xs" style={{ color: "#a9b1c4" }}>
                  {new Date(approval.requestedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
