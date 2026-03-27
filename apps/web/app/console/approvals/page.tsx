"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, MonoBadge } from "../../components/vela";

type Approval = { id: string; type: string; description: string; requestedAt: string };

function matchesFilter(text: string, q: string) {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

export default function ApprovalsPage() {
  const [items, setItems] = React.useState<Approval[]>([]);
  const [filter, setFilter] = React.useState("");
  React.useEffect(() => {
    fetch("/api/console/approvals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.approvals ?? []))
      .catch(() => setItems([]));
  }, []);

  const visible = items.filter(
    (a) =>
      matchesFilter(a.description, filter) ||
      matchesFilter(a.type, filter) ||
      matchesFilter(a.id, filter),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput
          placeholder="filter approvals… (Enter)"
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
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Pending Approvals</h2>
        <div className="space-y-3 max-w-2xl">
          {visible.length === 0 ? (
            <p className="font-mono text-sm text-[#6b7280]">
              {items.length === 0
                ? "No pending approvals."
                : "No approvals match this filter."}
            </p>
          ) : null}
          {visible.map((approval) => (
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
