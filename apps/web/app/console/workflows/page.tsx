"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput } from "../../components/vela";

export default function WorkflowsPage() {
  const [note, setNote] = React.useState("");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4">
        <CommandInput
          placeholder="search workflows… (Enter — saved as note for now)"
          onSubmit={(q) => setNote(q.trim())}
        />
        {note ? (
          <p className="font-mono text-[10px] text-[#6b7280] mt-2">
            Note: <span className="text-[#a9b1c4]">{note}</span>
            <button
              type="button"
              className="ml-2 text-[#52a7ff] hover:underline"
              onClick={() => setNote("")}
            >
              clear
            </button>
          </p>
        ) : null}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex items-center justify-center p-6"
      >
        <div className="text-center">
          <h2 className="font-mono text-xl mb-2" style={{ color: "#52a7ff" }}>
            Workflows
          </h2>
          <p style={{ color: "#a9b1c4" }}>
            Durable, resumable workflows for long-running executions.
          </p>
          <p className="font-mono text-xs mt-4" style={{ color: "#6ee7b7" }}>
            No workflows running yet
          </p>
          {note ? (
            <p className="font-mono text-xs mt-6 text-[#a9b1c4] max-w-md mx-auto">
              Workflow search isn&apos;t wired to a list yet — you entered:{" "}
              <span className="text-[#e8ecf4]">{note}</span>
            </p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
