"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TerminalLine } from "./terminal-line";

type TerminalPreviewLine = {
  prompt?: "$";
  status?: "ok" | "warn" | "err" | "tip";
  text: string;
  cursor?: boolean;
};

const terminalLines: TerminalPreviewLine[] = [
  { prompt: "$", text: "vela run deploy-pipeline --watch" },
  { status: "ok", text: "initialized control plane" },
  { status: "ok", text: "resolved 4 skills from registry" },
  { status: "warn", text: "awaiting approval: deploy to production" },
  { status: "ok", text: "approval granted · [human_001]" },
  { prompt: "$", text: "", cursor: true },
];

export function TerminalPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="bg-[#060910] border border-[#1f2635] rounded-xl p-4 font-mono text-sm w-full max-w-[480px]"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1f2635]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <span className="text-xs text-[#a9b1c4]">vela — boot</span>
        <div className="w-6" />
      </div>

      <div className="space-y-1">
        <AnimatePresence>
          {terminalLines.map((line, idx) => (
            <TerminalLine
              key={idx}
              {...(line.prompt ? { prompt: line.prompt } : {})}
              {...(line.status ? { status: line.status } : {})}
              delay={idx * 0.08}
              animate
            >
              {line.text}
              {line.cursor ? (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="ml-1 bg-[#52a7ff] inline-block w-[2px] h-[1em]"
                />
              ) : null}
            </TerminalLine>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
