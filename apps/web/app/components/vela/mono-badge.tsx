"use client";

import type { ReactNode } from "react";

type MonoBadgeProps = {
  children: ReactNode;
  variant?: "default" | "accent" | "ok" | "warn" | "err";
  className?: string;
};

const variantStyles = {
  default: "border-[#a9b1c4] text-[#a9b1c4]",
  accent: "border-[#52a7ff] text-[#52a7ff]",
  ok: "border-[#6ee7b7] text-[#6ee7b7]",
  warn: "border-[#fcd34d] text-[#fcd34d]",
  err: "border-[#fca5a5] text-[#fca5a5]",
};

export function MonoBadge({
  children,
  variant = "default",
  className = "",
}: MonoBadgeProps) {
  return (
    <span
      className={`font-mono text-xs px-2 py-1 rounded border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
