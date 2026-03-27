"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "./components/ui/button";
import { MonoBadge } from "./components/vela/mono-badge";

const FEATURES = [
  {
    title: "Multi-channel ingest",
    body: "Slack, Discord, Teams, and web traffic through the Vercel Chat SDK, normalized into threads and sessions. Same pipeline for demos via POST /api/events/web.",
  },
  {
    title: "Control plane",
    body: "Agents, threads, sessions, runs, and steps are persisted in Postgres—the source of truth replaces an always-on daemon process.",
  },
  {
    title: "AI SDK agent runtime",
    body: "Tool-loop execution with bindings from the registry. The model calls only what policy allows; no separate CLI required to run agents.",
  },
  {
    title: "Tool router & MCP",
    body: "Built-in tools, MCP servers from the registry, discovery/sync, health-driven refresh, and gated execution when scopes or policies demand it.",
  },
  {
    title: "Approvals & audit",
    body: "Human-in-the-loop for gated tool calls and workflows, with quorum, expiry, and vote history you can inspect in the console.",
  },
  {
    title: "Secrets lifecycle",
    body: "Bindings per tenant and agent, rotate and revoke APIs, and enforcement when tools declare a required_secret_provider.",
  },
  {
    title: "Memory layers",
    body: "Session-scoped working memory plus optional long-term vector memory (embeddings in Postgres) when you enable it.",
  },
  {
    title: "Workflows & sandbox",
    body: "Durable steps for long work, sandboxed operations with artifacts routed to Vercel Blob when configured.",
  },
  {
    title: "Console & observability",
    body: "Web console for runs, approvals, MCP, secrets, and run_events-backed visibility—what you run in production today.",
  },
] as const;

const STACK = [
  {
    label: "Interaction",
    items: ["Web UI & API events", "Slack · Discord · Teams webhooks"],
  },
  {
    label: "Control plane",
    items: ["Agents, threads, sessions", "Runs, steps, approvals"],
  },
  {
    label: "Runtime & routing",
    items: ["AI SDK tool loop", "Skill resolver", "Tool router + MCP"],
  },
  {
    label: "Persistence",
    items: ["Neon / Postgres", "Blob artifacts", "run_events"],
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#07090c] text-[#e8ecf4] terminal-grid-bg">
      <header className="sticky top-0 z-20 border-b border-[#1f2635] bg-[#07090c]/90 backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3 min-w-0"
            aria-label="Vela home"
          >
            <Image
              src="/vela-mark.svg"
              alt=""
              width={36}
              height={42}
              className="h-9 w-auto shrink-0"
              priority
            />
            <span
              className="text-xl font-semibold tracking-tight text-[#e8ecf4] truncate"
              style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
            >
              Vela
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/console/runs"
              className="hidden sm:inline font-mono text-xs text-[#a9b1c4] hover:text-[#52a7ff] transition-colors"
            >
              Runs
            </Link>
            <Link
              href="/console/approvals"
              className="hidden md:inline font-mono text-xs text-[#a9b1c4] hover:text-[#52a7ff] transition-colors"
            >
              Approvals
            </Link>
            <Link
              href="/console/mcp"
              className="hidden lg:inline font-mono text-xs text-[#a9b1c4] hover:text-[#52a7ff] transition-colors"
            >
              MCP
            </Link>
            <Link href="/console">
              <Button
                size="sm"
                className="bg-[#52a7ff] text-[#07090c] hover:bg-[#52a7ff]/90 font-mono font-semibold"
              >
                Console
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">
        <section className="w-full border-b border-[#1f2635] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="max-w-[1400px] mx-auto grid gap-12 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] items-start">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="mb-5">
                <MonoBadge variant="accent">Open source · Vercel-first</MonoBadge>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.1] mb-6 text-balance">
                A control plane for governed, multi-channel agents
              </h1>
              <p
                className="text-base sm:text-lg max-w-2xl mb-8 text-pretty"
                style={{ color: "#a9b1c4", lineHeight: 1.65 }}
              >
                Vela is not a CLI and not a chat wrapper—it is a persisted operating
                layer for agents: channels feed one ingest path, the runtime executes
                with the AI SDK, and tools (including MCP) stay policy-bound. You
                operate it through the web console and APIs you already deploy.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link href="/console">
                  <Button
                    size="lg"
                    className="bg-[#52a7ff] text-[#07090c] hover:bg-[#52a7ff]/90 font-mono font-semibold"
                  >
                    Open console
                  </Button>
                </Link>
                <Link href="/console/runs">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#1f2635] text-[#52a7ff] hover:bg-[#52a7ff]/10 font-mono bg-transparent"
                  >
                    View runs
                  </Button>
                </Link>
                <Link href="/console/skills">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#1f2635] text-[#a9b1c4] hover:bg-[#1f2635] font-mono bg-transparent"
                  >
                    Skills
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <MonoBadge variant="default">AI SDK 6 tool loop</MonoBadge>
                <MonoBadge variant="default">Chat SDK channels</MonoBadge>
                <MonoBadge variant="default">MCP registry</MonoBadge>
                <MonoBadge variant="default">Postgres + Blob</MonoBadge>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="rounded-xl border border-[#1f2635] bg-[#0a0e16] overflow-hidden lg:sticky lg:top-18"
            >
              <div className="border-b border-[#1f2635] px-4 py-3 flex items-center justify-between bg-[#060910]">
                <span
                  className="font-mono text-xs text-[#a9b1c4]"
                  style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                >
                  architecture · today
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#52a7ff]/90">
                  no CLI required
                </span>
              </div>
              <div className="p-4 sm:p-5 space-y-6">
                {STACK.map((block) => (
                  <div key={block.label}>
                    <div
                      className="font-mono text-xs text-[#52a7ff] mb-2"
                      style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                    >
                      {block.label}
                    </div>
                    <ul className="space-y-1.5 pl-0 list-none">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="font-mono text-sm text-[#e8ecf4]/95 border-l-2 border-[#1f2635] pl-3 py-0.5"
                          style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.aside>
          </div>
        </section>

        <section className="w-full px-4 py-14 sm:px-6 lg:px-10 lg:py-20 border-b border-[#1f2635]">
          <div className="max-w-[1400px] mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35 }}
              className="mb-10 max-w-2xl"
            >
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">What ships in the repo</h2>
              <p className="text-[#a9b1c4] leading-relaxed">
                Concrete surfaces and packages you can run on Vercel today—not a mock
                terminal. Each item maps to code in this monorepo or the web app routes
                you can open after deploy.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <motion.article
                  key={f.title}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-32px" }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="rounded-lg border border-[#1f2635] bg-[#0a0e16] p-5 hover:border-[#52a7ff]/35 transition-colors"
                >
                  <h3 className="font-mono text-sm text-[#e8ecf4] font-semibold mb-2">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#a9b1c4]">{f.body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <footer className="w-full px-4 py-8 sm:px-6 lg:px-10">
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-mono text-xs text-[#a9b1c4]">
            <div className="flex items-center gap-2">
              <Image
                src="/vela-mark.svg"
                alt=""
                width={24}
                height={28}
                className="h-6 w-auto opacity-90"
              />
              <span style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                Vela
              </span>
              <span className="text-[#1f2635]">·</span>
              <span>cloud-native agent OS</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <span>control-plane · tool-router · workflow · sandbox</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
