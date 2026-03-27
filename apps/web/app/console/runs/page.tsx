"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, RunCard, StatusDot } from "../../components/vela";

type RunItem = {
  id: string;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed";
  trigger: string;
  startedAt: string;
  steps: { type: string; tool: string; duration: string; status: "ok" | "warn" | "err" }[];
};

export default function RunsPage() {
  const [runs, setRuns] = React.useState<RunItem[]>([]);
  React.useEffect(() => {
    fetch("/api/console/runs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => setRuns([]));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput />
      </div>
      <div className="flex-1 flex overflow-hidden">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-[#1f2635]">
          <h2 className="font-mono text-sm mb-4" style={{ color: "#a9b1c4" }}>
            Recent runs
          </h2>
          <div className="space-y-3">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                id={run.id}
                status={run.status}
                trigger={run.trigger}
                timeAgo={new Date(run.startedAt).toLocaleString()}
                steps={run.steps}
              />
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="w-[280px] border-l border-[#1f2635] bg-[#0a0e16] overflow-y-auto">
          <div className="border-b border-[#1f2635] p-4">
            <h3 className="font-mono text-xs font-semibold mb-4" style={{ color: "#a9b1c4" }}>System Status</h3>
            <div className="space-y-3">
              {["Control Plane", "Agent Runtime", "Tool Router", "Workflow", "Sandbox"].map((layer) => (
                <div key={layer} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <StatusDot status="ok" size="sm" />
                    <span className="font-mono" style={{ color: "#a9b1c4" }}>{layer}</span>
                  </div>
                  <span className="font-mono text-[#6ee7b7]">ok</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
