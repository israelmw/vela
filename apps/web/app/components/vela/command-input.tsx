"use client";

import React from "react";

interface CommandInputProps {
  placeholder?: string;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  /** Chat-style: Enter sends, Shift+Enter newline */
  multiline?: boolean;
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
}

export function CommandInput({
  placeholder = "run agent task...",
  onSubmit,
  className = "",
  disabled = false,
  multiline = false,
}: CommandInputProps) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      const k = e.key?.toLowerCase();
      if (k !== "k") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      e.preventDefault();
      if (multiline) {
        textareaRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, multiline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit || !value.trim() || disabled) return;
    const next = value;
    setValue("");
    await Promise.resolve(onSubmit(next));
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div
        className={`flex gap-2 border border-[#1f2635] bg-[#0f1218] rounded px-3 py-2 focus-within:border-[#52a7ff] focus-within:border-opacity-50 transition-colors ${
          multiline ? "items-start" : "items-center"
        }`}
      >
        <span className="font-mono text-sm pt-0.5" style={{ color: "#6ee7b7" }}>
          $
        </span>
        {multiline ? (
          <textarea
            ref={textareaRef}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className="flex-1 min-h-[4.5rem] max-h-48 resize-y bg-transparent border-0 outline-none font-mono text-sm text-[#e8ecf4] placeholder-[#a9b1c4] disabled:opacity-50"
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className="flex-1 bg-transparent border-0 outline-none font-mono text-sm text-[#e8ecf4] placeholder-[#a9b1c4] disabled:opacity-50"
          />
        )}
        <kbd
          className="hidden sm:flex items-center gap-1 font-mono text-xs px-2 py-1 rounded border border-[#1f2635] text-[#a9b1c4]"
          aria-hidden
          title="Focus command bar"
        >
          <span>{isApplePlatform() ? "⌘" : "Ctrl"}</span>
          <span>K</span>
        </kbd>
      </div>
    </form>
  );
}
