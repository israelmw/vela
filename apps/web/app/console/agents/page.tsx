"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";

type Agent = { id: string; name: string; model: string; status: "active" | "inactive" | "archived"; skills: number };

function matchesFilter(text: string, q: string) {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

export default function AgentsPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [filter, setFilter] = React.useState("");
  React.useEffect(() => {
    fetch("/api/console/agents", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => setAgents([]));
  }, []);

  const visible = agents.filter(
    (a) =>
      matchesFilter(a.name, filter) ||
      matchesFilter(a.id, filter) ||
      matchesFilter(a.model, filter),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput
          placeholder="search agents… (Enter)"
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
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Registered Agents</h2>
        <div className="space-y-3 max-w-2xl">
          {visible.length === 0 ? (
            <p className="font-mono text-sm text-[#6b7280]">
              {agents.length === 0 ? "No agents." : "No agents match this filter."}
            </p>
          ) : null}
          {visible.map((agent) => (
            <div key={agent.id} className="border border-[#1f2635] bg-[#0f1218] rounded p-4 hover:border-[#52a7ff]/50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={agent.status === "active" ? "ok" : "warn"} size="sm" />
                <span className="text-sm font-mono text-[#e8ecf4]">{agent.name}</span>
              </div>
              <div className="font-mono text-xs mb-2" style={{ color: "#a9b1c4" }}>{agent.id}</div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span style={{ color: "#52a7ff" }}>{agent.model}</span>
                <span style={{ color: "#6ee7b7" }}>{agent.skills} tool bindings</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
