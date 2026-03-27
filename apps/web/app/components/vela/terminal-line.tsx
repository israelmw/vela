"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type TerminalLineProps = {
  prompt?: string;
  status?: "ok" | "warn" | "err" | "tip";
  children: ReactNode;
  delay?: number;
  animate?: boolean;
};

const statusColors = {
  ok: "#6ee7b7",
  warn: "#fcd34d",
  err: "#fca5a5",
  tip: "#a9b1c4",
};

const statusPrefixes = {
  ok: "[ok]",
  warn: "[warn]",
  err: "[err]",
  tip: "[tip]",
};

export function TerminalLine({
  prompt = "prompt",
  status,
  children,
  delay = 0,
  animate = true,
}: TerminalLineProps) {
  const variants = {
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, delay },
    },
  };

  return (
    <motion.div
      {...(animate ? { variants, initial: "hidden", animate: "visible" } : {})}
      className="font-mono text-sm leading-relaxed"
    >
      {prompt === "$" ? <span style={{ color: "#6ee7b7" }}>$ </span> : null}
      {status ? (
        <span style={{ color: statusColors[status] }}>
          {statusPrefixes[status]}{" "}
        </span>
      ) : null}
      <span style={{ color: status ? statusColors[status] : "#a9b1c4" }}>
        {children}
      </span>
    </motion.div>
  );
}
