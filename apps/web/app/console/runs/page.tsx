"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CommandInput, RunCard, StatusDot } from "../../components/vela";

/** Stable thread for the web console so turns accumulate in one session. */
const CONSOLE_CHANNEL_REF = "vela-console";

type RunItem = {
  id: string;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed";
  trigger: string;
  startedAt: string;
  steps: { type: string; tool: string; duration: string; status: "ok" | "warn" | "err" }[];
};

type ChatLine =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "system"; text: string; runId: string };

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
  const transcriptRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    refreshRuns(setRuns);
  }, []);

  React.useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  async function handleSend(text: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const userLine: ChatLine = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };
    setLines((prev) => [...prev, userLine]);
    try {
      const res = await fetch("/api/events/web", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          channelRef: CONSOLE_CHANNEL_REF,
        }),
      });
      const json = (await res.json()) as { error?: string; runId?: string };
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
      const runId = json.runId;
      if (!runId) {
        throw new Error("missing runId in response");
      }
      setLines((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "Turn completed — agent run finished for this message.",
          runId,
        },
      ]);
      refreshRuns(setRuns);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4 space-y-2">
        <CommandInput
          placeholder="Message the agent… (Enter to send — same thread as console)"
          onSubmit={handleSend}
          disabled={busy}
        />
        <p className="font-mono text-[10px] text-[#6b7280]">
          Session <span className="text-[#a9b1c4]">{CONSOLE_CHANNEL_REF}</span>
          {" · "}
          one agent run per message.
        </p>
        {error ? (
          <p className="font-mono text-xs text-[#fca5a5]">{error}</p>
        ) : null}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-[#1f2635] flex flex-col min-h-0"
        >
          <div>
            <h2 className="font-mono text-sm mb-2" style={{ color: "#a9b1c4" }}>
              Conversation
            </h2>
            <div
              ref={transcriptRef}
              className="max-h-48 overflow-y-auto rounded-lg border border-[#1f2635] bg-[#060910] p-3 space-y-2"
            >
              {lines.length === 0 ? (
                <p className="font-mono text-xs text-[#6b7280]">
                  No messages yet. Each send runs one agent turn (like the old “prompt
                  input” on the home console).
                </p>
              ) : (
                lines.map((line) =>
                  line.role === "user" ? (
                    <div key={line.id} className="font-mono text-sm text-[#e8ecf4]">
                      <span className="text-[#6ee7b7]">you</span>{" "}
                      <span className="text-[#a9b1c4]">·</span> {line.text}
                    </div>
                  ) : (
                    <div key={line.id} className="font-mono text-sm text-[#a9b1c4]">
                      <span className="text-[#52a7ff]">vela</span>{" "}
                      <span className="text-[#6b7280]">·</span> {line.text}{" "}
                      <Link
                        href={`/console/runs/${line.runId}`}
                        className="text-[#52a7ff] hover:underline"
                      >
                        open run {line.runId.slice(0, 8)}…
                      </Link>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <h2 className="font-mono text-sm mb-2" style={{ color: "#a9b1c4" }}>
            Recent runs
          </h2>
          <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                id={run.id}
                status={run.status}
                trigger={run.trigger}
                timeAgo={new Date(run.startedAt).toLocaleString()}
                steps={run.steps}
              />
            ))}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-[280px] border-l border-[#1f2635] bg-[#0a0e16] overflow-y-auto"
        >
          <div className="border-b border-[#1f2635] p-4">
            <h3
              className="font-mono text-xs font-semibold mb-4"
              style={{ color: "#a9b1c4" }}
            >
              System Status
            </h3>
            <div className="space-y-3">
              {["Control Plane", "Agent Runtime", "Tool Router", "Workflow", "Sandbox"].map(
                (layer) => (
                  <div key={layer} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <StatusDot status="ok" size="sm" />
                      <span className="font-mono" style={{ color: "#a9b1c4" }}>
                        {layer}
                      </span>
                    </div>
                    <span className="font-mono text-[#6ee7b7]">ok</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
