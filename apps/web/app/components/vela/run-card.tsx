"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface RunStep {
  type: string;
  tool: string;
  duration: string;
  status: "ok" | "warn" | "err";
}

interface RunCardProps {
  id: string;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed";
  trigger: string;
  timeAgo: string;
  steps?: RunStep[];
  onApprove?: () => void;
  onReject?: () => void;
}

const statusColors = {
  pending: "#a9b1c4",
  running: "#52a7ff",
  awaiting_approval: "#fcd34d",
  completed: "#6ee7b7",
  failed: "#fca5a5",
};

const statusLabels = {
  pending: "pending",
  running: "running",
  awaiting_approval: "awaiting approval",
  completed: "completed",
  failed: "failed",
};

export function RunCard({
  id,
  status,
  trigger,
  timeAgo,
  steps,
  onApprove,
  onReject,
}: RunCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-[#1f2635] rounded-lg bg-[#0f1218] p-4 hover:bg-[#0a0e16] transition-colors"
    >
      <div
        className="cursor-pointer space-y-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-[#a9b1c4] tabular-nums shrink-0">
              {id.slice(0, 8)}
            </span>
            <span
              className="px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wide shrink-0"
              style={{
                borderColor: statusColors[status],
                color: statusColors[status],
              }}
            >
              {statusLabels[status]}
            </span>
          </div>
          <ChevronDown
            size={16}
            className="shrink-0 text-[#a9b1c4] transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
        <div className="text-sm text-[#e8ecf4] min-w-0 truncate" title={trigger}>
          {trigger}
        </div>
        <div className="text-xs text-[#a9b1c4] font-mono tabular-nums wrap-break-word">
          {timeAgo}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-[#1f2635]"
          >
            {steps && steps.length > 0 && (
              <div className="space-y-3 mb-4">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            step.status === "err"
                              ? "#fca5a5"
                              : step.status === "warn"
                                ? "#fcd34d"
                                : "#6ee7b7",
                        }}
                      />
                      {idx < steps.length - 1 && (
                        <div className="w-0.5 h-12 bg-[#1f2635]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="font-mono text-xs text-[#52a7ff]">{step.type}</div>
                      <div className="text-sm text-[#e8ecf4]">{step.tool}</div>
                      <div className="text-xs text-[#a9b1c4]">{step.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {status === "awaiting_approval" && (
              <div className="border border-[#fcd34d] bg-[#fcd34d]/10 rounded p-3 flex gap-2">
                <button
                  onClick={onApprove}
                  className="px-3 py-1 rounded text-xs font-mono bg-[#6ee7b7] text-[#07090c] hover:opacity-80 transition-opacity"
                >
                  Approve
                </button>
                <button
                  onClick={onReject}
                  className="px-3 py-1 rounded text-xs font-mono border border-[#fca5a5] text-[#fca5a5] hover:bg-[#fca5a5]/10 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
