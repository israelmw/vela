import {
  installCapabilityForAgent,
  listCapabilityInstallsForAgent,
  listCapabilityPackages,
  upsertCapabilityPackage,
} from "@vela/capabilities";
import { ensureDefaultAgent } from "@vela/control-plane";
import { db } from "@vela/db";
import { NextResponse } from "next/server";
import type { CapabilityManifest } from "@vela/types";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function GET() {
  const tenantId = DEFAULT_TENANT_ID;
  const agent = await ensureDefaultAgent(db, tenantId);
  const [packages, installs] = await Promise.all([
    listCapabilityPackages(db),
    listCapabilityInstallsForAgent(db, { tenantId, agentId: agent.id }),
  ]);
  const installByRef = new Map(installs.map((i) => [i.packageRef, i]));

  const packs = packages.map((p) => {
    const m = p.manifest as CapabilityManifest;
    const skillCount = Array.isArray(m.skills) ? m.skills.length : 0;
    const toolCount = Array.isArray(m.tools) ? m.tools.length : 0;
    const ins = installByRef.get(p.ref);
    return {
      id: p.id,
      ref: p.ref,
      version: p.version,
      name: p.name,
      skillCount,
      toolCount,
      installed: !!ins,
      enabled: ins?.enabled ?? false,
      manifest: m,
    };
  });

  return NextResponse.json({ tenantId, packs });
}

/**
 * Register or update a skill pack in `capability_packages`, then optionally install it
 * for the default agent (syncs embedded skill rows into `skills_registry`).
 *
 * Body JSON: { ref, name, version, manifest?, install? }
 * — `manifest` defaults to `{ skills: [], tools: [] }`.
 * — `install` defaults to true (calls `installCapabilityForAgent` after upsert).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    ref?: string;
    name?: string;
    version?: string;
    manifest?: unknown;
    install?: boolean;
  };

  const ref = body.ref?.trim();
  const name = body.name?.trim();
  const version = body.version?.trim();
  if (!ref || !name || !version) {
    return NextResponse.json(
      { error: "ref, name, and version are required (strings)" },
      { status: 400 },
    );
  }

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const manifest =
    body.manifest !== undefined && body.manifest !== null
      ? body.manifest
      : { skills: [], tools: [] };
  const doInstall = body.install !== false;

  try {
    await upsertCapabilityPackage(db, {
      ref,
      name,
      version,
      manifest,
      source: "console",
    });

    if (doInstall) {
      const agent = await ensureDefaultAgent(db, tenantId);
      await installCapabilityForAgent(db, {
        tenantId,
        agentId: agent.id,
        packageRef: ref,
      });
    }

    return NextResponse.json({
      ok: true,
      ref,
      installed: doInstall,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
