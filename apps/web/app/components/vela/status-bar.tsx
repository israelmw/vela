"use client";

import { motion } from "framer-motion";
import { StatusDot } from "./status-dot";

export function StatusBar() {
  const statuses = [
    { label: "control-plane", status: "ok" as const },
    { label: "tool-router", status: "ok" as const },
    { label: "workflow", status: "ok" as const },
    { label: "sandbox", status: "ok" as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="w-full border-t border-[#1f2635] bg-[#0a0e16] px-4 py-2 font-mono text-xs flex items-center justify-between text-[#a9b1c4]"
    >
      <div className="flex items-center gap-6">
        {statuses.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <StatusDot status={s.status} size="sm" />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span>4 agents</span>
        <span>·</span>
        <span>12 runs</span>
        <span>·</span>
        <span>3 pending approvals</span>
      </div>
    </motion.div>
  );
}
