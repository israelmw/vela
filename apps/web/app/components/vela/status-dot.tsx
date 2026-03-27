"use client";

import { motion } from "framer-motion";

type StatusDotProps = {
  status: "ok" | "warn" | "err";
  pulsing?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const statusColors = {
  ok: "#6ee7b7",
  warn: "#fcd34d",
  err: "#fca5a5",
};

const sizeMap = {
  sm: 6,
  md: 8,
  lg: 12,
};

export function StatusDot({
  status,
  pulsing = false,
  label,
  size = "md",
}: StatusDotProps) {
  const dotSize = sizeMap[size];

  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={pulsing ? { opacity: [1, 0.5, 1] } : {}}
        transition={pulsing ? { duration: 2, repeat: Infinity } : {}}
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: statusColors[status],
          borderRadius: "50%",
        }}
      />
      {label ? (
        <span className="text-xs" style={{ color: "#a9b1c4" }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
