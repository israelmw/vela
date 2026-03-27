"use client";

import { motion } from "framer-motion";
import { CommandInput } from "../../components/vela";

export default function WorkflowsPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput placeholder="search workflows..." />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="font-mono text-xl mb-2" style={{ color: "#52a7ff" }}>Workflows</h2>
          <p style={{ color: "#a9b1c4" }}>Durable, resumable workflows for long-running executions.</p>
          <p className="font-mono text-xs mt-4" style={{ color: "#6ee7b7" }}>No workflows running yet</p>
        </div>
      </motion.div>
    </div>
  );
}
