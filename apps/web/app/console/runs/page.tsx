"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { CommandInput, RunCard, StatusDot } from "../../components/vela";

/** Stable thread for the web console so turns accumulate in one session. */
const CONSOLE_CHANNEL_REF = "vela-console";

/** Geist Mono for assistant markdown (Streamdown wraps content in nested tags). */
const assistantMarkdownTypography =
  "font-[family-name:var(--font-geist-mono),ui-monospace,monospace] [&_*]:font-[family-name:var(--font-geist-mono),ui-monospace,monospace]";

type RunItem = {
  id: string;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed";
  trigger: string;
  startedAt: string;
  steps: { type: string; tool: string; duration: string; status: "ok" | "warn" | "err" }[];
};

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function refreshRuns(setRuns: (r: RunItem[]) => void) {
  fetch("/api/console/runs", { credentials: "include" })
    .then((r) => r.json())
    .then((d) => setRuns(d.runs ?? []))
    .catch(() => setRuns([]));
}

export default function RunsPage() {
  const [runs, setRuns] = React.useState<RunItem[]>([]);
  const [lines, setLines] = React.useState<ChatLine[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRunId, setLastRunId] = React.useState<string | null>(null);

  const loadChat = React.useCallback(async () => {
    const r = await fetch(
      `/api/console/chat?channelRef=${encodeURIComponent(CONSOLE_CHANNEL_REF)}`,
      { credentials: "include" },
    );
    const d = (await r.json()) as {
      messages?: { id: string; role: string; text: string }[];
    };
    const raw = d.messages ?? [];
    setLines(
      raw
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          text: typeof m.text === "string" ? m.text : String(m.text ?? ""),
        })),
    );
  }, []);

  React.useEffect(() => {
    refreshRuns(setRuns);
    loadChat().catch(() => setLines([]));
  }, [loadChat]);

  async function handleSend(text: string) {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setLines((prev) => [...prev, { id: optimisticId, role: "user", text: trimmed }]);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/web", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          channelRef: CONSOLE_CHANNEL_REF,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        runId?: string;
        assistantText?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
      if (!json.runId) {
        throw new Error("missing runId in response");
      }
      setLastRunId(json.runId);
      await loadChat();
      refreshRuns(setRuns);
    } catch (e) {
      setLines((prev) => prev.filter((l) => l.id !== optimisticId));
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#1f2635]">
          <Conversation className="min-h-0">
            <ConversationContent className="gap-4 px-6 py-5">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <h2
                  className="font-mono text-xs uppercase tracking-wide"
                  style={{ color: "#6b7280" }}
                >
                  Chat
                </h2>
                {lastRunId ? (
                  <Link
                    href={`/console/runs/${lastRunId}`}
                    className="shrink-0 font-mono text-[10px] text-[#52a7ff] hover:underline"
                  >
                    Last run · debug
                  </Link>
                ) : null}
              </div>
              {lines.length === 0 && !busy ? (
                <p className="max-w-lg font-mono text-sm text-[#6b7280]">
                  Send a message to talk to the agent. Replies show here; one agent turn runs per
                  message (same session thread{" "}
                  <span className="text-[#a9b1c4]">{CONSOLE_CHANNEL_REF}</span>).
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {lines.map((line, idx) =>
                    line.role === "user" ? (
                      <div key={`${line.id}-user-${idx}`} className="flex justify-end">
                        <div className="max-w-[min(100%,42rem)] rounded-lg border border-[#52a7ff]/25 bg-[#52a7ff]/8 px-4 py-3">
                          <div className="mb-1 font-mono text-[10px] text-[#6ee7b7]">you</div>
                          <div className="wrap-break-word font-mono text-sm whitespace-pre-wrap text-[#e8ecf4]">
                            {line.text}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={`${line.id}-assistant-${idx}`} className="flex justify-start">
                        <div className="max-w-[min(100%,42rem)] rounded-lg border border-[#1f2635] bg-[#0f1218] px-4 py-3 shadow-sm">
                          <div className="mb-1 font-mono text-[10px] text-[#52a7ff]">vela</div>
                          <MessageResponse
                            className={`max-w-none text-sm leading-relaxed text-[#e8ecf4] ${assistantMarkdownTypography}`}
                          >
                            {line.text}
                          </MessageResponse>
                        </div>
                      </div>
                    ),
                  )}
                  {busy ? (
                    <div className="flex justify-start" aria-live="polite">
                      <div className="max-w-[min(100%,42rem)] rounded-lg border border-[#1f2635] bg-[#0f1218] px-4 py-3 shadow-sm">
                        <div className="mb-1 font-mono text-[10px] text-[#52a7ff]">vela</div>
                        <div className="flex items-center gap-2 font-mono text-sm text-[#fcd34d]">
                          <span
                            className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-[#fcd34d]"
                            aria-hidden
                          />
                          thinking…
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton
              type="button"
              variant="outline"
              className="bottom-28 z-10 border-[#1f2635] bg-[#0f1218] text-[#a9b1c4] shadow-lg hover:bg-[#1f2635] dark:bg-[#0f1218] dark:hover:bg-[#1f2635]"
            />
          </Conversation>

          <div className="shrink-0 space-y-2 border-t border-[#1f2635] bg-[#0a0e16] px-6 py-4">
            <CommandInput
              multiline
              placeholder="Message the agent… (Enter to send · Shift+Enter newline)"
              onSubmit={handleSend}
              disabled={busy}
            />
            <p className="font-mono text-[10px] text-[#6b7280]">
              Session <span className="text-[#a9b1c4]">{CONSOLE_CHANNEL_REF}</span>
            </p>
            {error ? (
              <p className="font-mono text-xs text-[#fca5a5]">{error}</p>
            ) : null}
          </div>
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="flex min-h-0 w-[min(100%,280px)] shrink-0 flex-col overflow-hidden bg-[#0a0e16]"
        >
          <div className="border-b border-[#1f2635] p-4">
            <h3
              className="font-mono text-xs font-semibold mb-3"
              style={{ color: "#a9b1c4" }}
            >
              System
            </h3>
            <div className="space-y-2">
              {["Control Plane", "Agent Runtime", "Tool Router", "Workflow", "Sandbox"].map(
                (layer) => (
                  <div key={layer} className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot status="ok" size="sm" />
                      <span className="text-[#a9b1c4] truncate">{layer}</span>
                    </div>
                    <span className="text-[#6ee7b7] shrink-0">ok</span>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="p-4 flex-1 min-h-0 flex flex-col">
            <h3 className="font-mono text-xs font-semibold mb-3" style={{ color: "#a9b1c4" }}>
              Recent runs
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1">
              {runs.length === 0 ? (
                <p className="font-mono text-[10px] text-[#6b7280]">No runs yet.</p>
              ) : (
                runs.map((run) => (
                  <RunCard
                    key={run.id}
                    id={run.id}
                    status={run.status}
                    trigger={run.trigger}
                    timeAgo={new Date(run.startedAt).toLocaleString()}
                    steps={run.steps}
                  />
                ))
              )}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
