"use client";

import React from "react";

interface CommandInputProps {
  placeholder?: string;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function CommandInput({
  placeholder = "run agent task...",
  onSubmit,
  className = "",
}: CommandInputProps) {
  const [value, setValue] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && value.trim()) {
      onSubmit(value);
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="flex items-center gap-2 border border-[#1f2635] bg-[#0f1218] rounded px-3 py-2 focus-within:border-[#52a7ff] focus-within:border-opacity-50 transition-colors">
        <span className="font-mono text-sm" style={{ color: "#6ee7b7" }}>
          $
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 outline-none font-mono text-sm text-[#e8ecf4] placeholder-[#a9b1c4]"
        />
        <kbd className="hidden sm:flex items-center gap-1 font-mono text-xs px-2 py-1 rounded border border-[#1f2635] text-[#a9b1c4]">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </div>
    </form>
  );
}
