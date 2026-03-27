"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";

type Server = {
  id: string;
  name: string;
  status: "active" | "failed";
  tools: number;
  lastHealthCheck: string | null;
};

function matchesFilter(text: string, q: string) {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

/** Parse bar input: register MCP when URL or explicit add syntax; otherwise null = filter text. */
function tryParseMcpRegister(raw: string): { id: string; name: string; url: string } | null {
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s) as { id?: string; name?: string; url?: string };
      const id = j.id?.trim();
      const name = j.name?.trim();
      const url = j.url?.trim();
      if (id && name && url) return { id, name, url };
    } catch {
      return null;
    }
    return null;
  }

  let rest = s;
  const lower = s.toLowerCase();
  if (lower.startsWith("add ")) {
    rest = s.slice(4).trim();
  }

  const spaced = /^(\S+)\s+(https?:\/\/\S+)$/i.exec(rest);
  if (spaced?.[1] && spaced[2]) {
    const id = spaced[1];
    const url = spaced[2];
    return { id, name: id, url };
  }

  if (/^https?:\/\//i.test(rest) && !rest.includes("|")) {
    try {
      const u = new URL(rest);
      const id = u.hostname.replace(/^www\./, "").replace(/\./g, "-");
      return { id, name: u.hostname, url: rest };
    } catch {
      return null;
    }
  }

  if (rest.includes("|")) {
    const parts = rest.split("|").map((p) => p.trim());
    const [a, b, c] = parts;
    if (parts.length === 3 && c && /^https?:\/\//i.test(c) && a && b) {
      return { id: a, name: b, url: c };
    }
    if (parts.length === 2 && b && /^https?:\/\//i.test(b) && a) {
      return { id: a, name: a, url: b };
    }
  }

  return null;
}

export default function MCPPage() {
  const [servers, setServers] = React.useState<Server[]>([]);
  const [filter, setFilter] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const loadServers = React.useCallback(() => {
    fetch("/api/console/mcp", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setServers(d.servers ?? []))
      .catch(() => setServers([]));
  }, []);

  React.useEffect(() => {
    loadServers();
  }, [loadServers]);

  const visible = servers.filter(
    (s) => matchesFilter(s.name, filter) || matchesFilter(s.id, filter),
  );

  async function handleCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setNotice(null);
    const reg = tryParseMcpRegister(trimmed);

    if (reg) {
      setBusy(true);
      try {
        const res = await fetch("/api/mcp/registry", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: reg.id,
            name: reg.name,
            url: reg.url,
            authType: "bearer",
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          mcpId?: string;
          discoveredCount?: number;
        };
        if (!res.ok) {
          throw new Error(json.error ?? res.statusText);
        }
        setFilter("");
        setNotice({
          kind: "ok",
          text: `Registered ${json.mcpId ?? reg.id} · ${json.discoveredCount ?? 0} tools discovered.`,
        });
        loadServers();
      } catch (e) {
        setNotice({
          kind: "err",
          text: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    setFilter(trimmed);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4 space-y-2">
        <CommandInput
          placeholder="Filter list, paste MCP URL, or: add my-id https://host/mcp"
          onSubmit={handleCommand}
          disabled={busy}
        />
        <p className="font-mono text-[10px] text-[#6b7280] leading-relaxed max-w-3xl">
          <span className="text-[#a9b1c4]">Register:</span> paste a URL (https://…) ·{" "}
          <span className="text-[#a9b1c4]">add</span> id url ·{" "}
          <span className="text-[#a9b1c4]">add</span> id|name|url · JSON with id/name/url.
          Anything else filters the table below.
        </p>
        {filter ? (
          <p className="font-mono text-[10px] text-[#6b7280]">
            Filter: <span className="text-[#a9b1c4]">{filter}</span>
            <button
              type="button"
              className="ml-2 text-[#52a7ff] hover:underline"
              onClick={() => setFilter("")}
            >
              clear
            </button>
          </p>
        ) : null}
        {notice ? (
          <p
            className={`font-mono text-xs ${notice.kind === "ok" ? "text-[#6ee7b7]" : "text-[#fca5a5]"}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-y-auto p-6"
      >
        <h2 className="font-mono text-sm mb-6" style={{ color: "#a9b1c4" }}>
          Connected MCP Servers
        </h2>
        <div className="space-y-3 max-w-2xl">
          {visible.length === 0 ? (
            <p className="font-mono text-sm text-[#6b7280]">
              {servers.length === 0
                ? "No MCP servers in registry — register one with a URL above (needs reachable JSON-RPC)."
                : "No servers match this filter."}
            </p>
          ) : null}
          {visible.map((server) => (
            <div
              key={server.id}
              className="border border-[#1f2635] bg-[#0f1218] rounded p-4 hover:border-[#52a7ff]/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusDot
                  status={server.status === "failed" ? "err" : "ok"}
                  pulsing
                  size="sm"
                />
                <span className="text-sm font-mono text-[#e8ecf4]">{server.name}</span>
              </div>
              <div className="font-mono text-xs mb-2" style={{ color: "#a9b1c4" }}>
                {server.id}
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span style={{ color: "#52a7ff" }}>{server.tools} tools</span>
                <span style={{ color: "#a9b1c4" }}>
                  {server.lastHealthCheck
                    ? new Date(server.lastHealthCheck).toLocaleString()
                    : "never"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
