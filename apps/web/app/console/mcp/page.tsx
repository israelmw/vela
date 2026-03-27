"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";

type Server = { id: string; name: string; status: "active" | "failed"; tools: number; lastHealthCheck: string | null };

export default function MCPPage() {
  const [servers, setServers] = React.useState<Server[]>([]);
  React.useEffect(() => {
    fetch("/api/console/mcp", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setServers(d.servers ?? []))
      .catch(() => setServers([]));
  }, []);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput placeholder="search MCP servers..." />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto p-6">
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>Connected MCP Servers</h2>
        <div className="space-y-3 max-w-2xl">
          {servers.map((server) => (
            <div key={server.id} className="border border-[#1f2635] bg-[#0f1218] rounded p-4 hover:border-[#52a7ff]/50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={server.status === "failed" ? "err" : "ok"} pulsing size="sm" />
                <span className="text-sm font-mono text-[#e8ecf4]">{server.name}</span>
              </div>
              <div className="font-mono text-xs mb-2" style={{ color: "#a9b1c4" }}>{server.id}</div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span style={{ color: "#52a7ff" }}>{server.tools} tools</span>
                <span style={{ color: "#a9b1c4" }}>{server.lastHealthCheck ? new Date(server.lastHealthCheck).toLocaleString() : "never"}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
