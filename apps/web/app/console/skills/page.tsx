"use client";

import React from "react";
import { motion } from "framer-motion";
import { CommandInput, StatusDot } from "../../components/vela";
import type { CapabilityManifest } from "@vela/types";

type PackRow = {
  id: string;
  ref: string;
  version: string;
  name: string;
  skillCount: number;
  toolCount: number;
  installed: boolean;
  enabled: boolean;
  manifest: CapabilityManifest;
};

function matchesFilter(p: PackRow, q: string) {
  if (!q) return true;
  const n = q.toLowerCase();
  return (
    p.ref.toLowerCase().includes(n) ||
    p.name.toLowerCase().includes(n) ||
    p.version.toLowerCase().includes(n)
  );
}

/** Paste a single-line JSON object to register a pack: { ref, name, version, manifest?, install? } */
function tryParsePackRegister(raw: string): {
  ref: string;
  name: string;
  version: string;
  manifest: unknown;
  install: boolean;
} | null {
  const s = raw.trim();
  if (!s.startsWith("{")) return null;
  try {
    const j = JSON.parse(s) as Record<string, unknown>;
    const ref = typeof j.ref === "string" ? j.ref.trim() : "";
    const name = typeof j.name === "string" ? j.name.trim() : "";
    const version = typeof j.version === "string" ? j.version.trim() : "";
    if (!ref || !name || !version) return null;
    const manifest =
      j.manifest !== undefined && j.manifest !== null
        ? j.manifest
        : { skills: [], tools: [] };
    const install = j.install !== false;
    return { ref, name, version, manifest, install };
  } catch {
    return null;
  }
}

/**
 * Text after `add` / `install` — ref, owner/repo/skill, or skills.sh URL.
 */
function tryParseAddCommandRest(raw: string): string | null {
  const m = /^(?:add|install)\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() ?? null;
}

export default function ConsoleSkillsPage() {
  const [packs, setPacks] = React.useState<PackRow[]>([]);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [busyRef, setBusyRef] = React.useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const barBusy = busyRef !== null || registerBusy;

  const load = React.useCallback(() => {
    fetch("/api/console/skills", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { packs?: PackRow[]; tenantId?: string }) => {
        setPacks(d.packs ?? []);
        setTenantId(d.tenantId ?? null);
      })
      .catch(() => {
        setPacks([]);
        setTenantId(null);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const visible = packs.filter((p) => matchesFilter(p, filter));

  async function setPackState(packageRef: string, action: "install" | "disable") {
    setBusyRef(packageRef);
    setNotice(null);
    try {
      const res = await fetch("/api/capabilities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageRef, action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
      setNotice({
        kind: "ok",
        text: action === "disable" ? `Disabled ${packageRef}` : `Installed ${packageRef}`,
      });
      load();
    } catch (e) {
      setNotice({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusyRef(null);
    }
  }

  async function handleCommand(raw: string) {
    const trimmed = raw.trim().replace(/^\$\s*/, "");
    if (!trimmed) return;
    setNotice(null);
    const reg = tryParsePackRegister(trimmed);
    if (reg) {
      setRegisterBusy(true);
      try {
        const res = await fetch("/api/console/skills", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref: reg.ref,
            name: reg.name,
            version: reg.version,
            manifest: reg.manifest,
            install: reg.install,
          }),
        });
        const json = (await res.json()) as { error?: string; installed?: boolean };
        if (!res.ok) {
          throw new Error(json.error ?? res.statusText);
        }
        setNotice({
          kind: "ok",
          text: `Registered ${reg.ref}${json.installed ? " · installed for default agent" : ""}`,
        });
        setFilter("");
        load();
      } catch (e) {
        setNotice({
          kind: "err",
          text: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setRegisterBusy(false);
      }
      return;
    }

    const addRest = tryParseAddCommandRest(trimmed);
    if (addRest) {
      setRegisterBusy(true);
      try {
        const skillsSh = /^https:\/\/skills\.sh\/([^/]+)\/([^/]+)\/([^/?#]+)/i.exec(
          addRest,
        );
        if (skillsSh?.[1] && skillsSh[2] && skillsSh[3]) {
          await importFromSkillsShGithub(skillsSh[1], skillsSh[2], skillsSh[3]);
          setFilter("");
          return;
        }
        const triple = /^([a-z0-9._-]+)\/([a-z0-9._-]+)\/([a-z0-9._-]+)$/i.exec(
          addRest,
        );
        if (triple?.[1] && triple[2] && triple[3]) {
          await importFromSkillsShGithub(triple[1], triple[2], triple[3]);
          setFilter("");
          return;
        }
        const inCatalog = packs.some((p) => p.ref === addRest);
        if (inCatalog) {
          await setPackState(addRest, "install");
          setFilter("");
          return;
        }
        await importFromSkillsShGithub("vercel-labs", "skills", addRest);
        setFilter("");
        return;
      } catch (e) {
        setNotice({
          kind: "err",
          text: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setRegisterBusy(false);
      }
      return;
    }

    setFilter(trimmed);
  }

  async function importFromSkillsShGithub(owner: string, repo: string, skill: string) {
    setNotice(null);
    const res = await fetch("/api/console/skills/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, skill }),
    });
    const json = (await res.json()) as { error?: string; ref?: string; name?: string };
    if (!res.ok) {
      throw new Error(json.error ?? res.statusText);
    }
    setNotice({
      kind: "ok",
      text: `Imported ${json.name ?? skill} → pack ${json.ref ?? ""}`,
    });
    load();
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-[#1f2635] bg-[#0a0e16] px-6 py-4 space-y-2">
        <CommandInput
          placeholder="filter… | add vela.demo-oss-pack | paste JSON { ref, name, version }…"
          onSubmit={handleCommand}
          disabled={barBusy}
        />
        <p className="font-mono text-[10px] text-[#6b7280] leading-relaxed max-w-3xl">
          <span className="text-[#a9b1c4]">Import from skills.sh / GitHub</span> (layout{" "}
          <code className="text-[#a9b1c4]">skills/&lt;id&gt;/SKILL.md</code>):{" "}
          <code className="text-[#a9b1c4]">add find-skills</code> →{" "}
          <code className="text-[#a9b1c4]">vercel-labs/skills</code>, or{" "}
          <code className="text-[#a9b1c4]">add vercel-labs/skills/find-skills</code>, or paste the{" "}
          <code className="text-[#a9b1c4]">skills.sh/…</code> URL.{" "}
          <span className="text-[#a9b1c4]">Install</span> existing local pack:{" "}
          <code className="text-[#a9b1c4]">add &lt;ref&gt;</code>.{" "}
          <span className="text-[#a9b1c4]">Register</span> manually: one-line JSON with{" "}
          <code className="text-[#a9b1c4]">ref</code>, <code className="text-[#a9b1c4]">name</code>,{" "}
          <code className="text-[#a9b1c4]">version</code>, optional{" "}
          <code className="text-[#a9b1c4]">manifest</code> / <code className="text-[#a9b1c4]">install: false</code>
          . skills.sh uses <code className="text-[#a9b1c4]">npx skills add &lt;repo&gt; --skill &lt;name&gt;</code>{" "}
          for local agents (Cursor, Claude Code, …); Vela stores packs in Postgres — use{" "}
          <code className="text-[#a9b1c4]">add</code> for a registered ref, or paste JSON to register.{" "}
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#52a7ff] hover:underline"
          >
            skills.sh
          </a>
          . Other input filters the list.
          {tenantId ? (
            <>
              {" "}
              Tenant <span className="text-[#a9b1c4]">{tenantId}</span>.
            </>
          ) : null}
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
          Skill packs
        </h2>
        <div className="space-y-3 max-w-2xl">
          {visible.length === 0 ? (
            <p className="font-mono text-sm text-[#6b7280]">
              {packs.length === 0
                ? "No skill packs yet — first web/slack message runs demo seed, or paste pack JSON in the bar above."
                : "No packs match this filter."}
            </p>
          ) : null}
          {visible.map((pack) => {
            const status =
              !pack.installed ? "warn" : pack.enabled ? "ok" : ("err" as const);
            const busy = busyRef === pack.ref;
            return (
              <div
                key={pack.id}
                className="border border-[#1f2635] bg-[#0f1218] rounded p-4 hover:border-[#52a7ff]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={status} size="sm" />
                      <span className="text-sm font-mono text-[#e8ecf4] truncate">{pack.name}</span>
                    </div>
                    <div className="font-mono text-xs mb-2 truncate" style={{ color: "#a9b1c4" }}>
                      {pack.ref} @ {pack.version}
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono gap-2">
                      <span style={{ color: "#52a7ff" }}>
                        {pack.skillCount} skill{pack.skillCount === 1 ? "" : "s"}
                      </span>
                      <span style={{ color: "#6ee7b7" }}>
                        {pack.toolCount} tool{pack.toolCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <details className="mt-3 group">
                      <summary className="font-mono text-[10px] text-[#6b7280] cursor-pointer hover:text-[#a9b1c4] list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                        <span className="group-open:rotate-90 inline-block transition-transform duration-150">
                          ›
                        </span>
                        manifest
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded border border-[#1f2635] bg-[#060910] p-3 text-[10px] font-mono text-[#a9b1c4] leading-relaxed">
                        {JSON.stringify(pack.manifest, null, 2)}
                      </pre>
                    </details>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {pack.installed && pack.enabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPackState(pack.ref, "disable")}
                        className="px-3 py-1 rounded text-xs font-mono border border-[#1f2635] text-[#a9b1c4] hover:bg-[#1f2635] hover:text-[#e8ecf4] disabled:opacity-50"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPackState(pack.ref, "install")}
                        className="px-3 py-1 rounded text-xs font-mono bg-[#52a7ff] text-[#07090c] hover:bg-[#52a7ff]/90 disabled:opacity-50"
                      >
                        {pack.installed ? "Re-enable" : "Install"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
