import {
  disableCapabilityForAgent,
  installCapabilityForAgent,
  listCapabilityInstallsForAgent,
  listCapabilityPackages,
} from "@vela/capabilities";
import { db } from "@vela/db";
import { ensureDefaultAgent } from "@vela/control-plane";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;

  const agent = await ensureDefaultAgent(db, tenantId);
  const [packages, installs] = await Promise.all([
    listCapabilityPackages(db),
    listCapabilityInstallsForAgent(db, {
      tenantId,
      agentId: agent.id,
    }),
  ]);

  return NextResponse.json({ packages, installs });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    tenantId?: string;
    packageRef?: string;
    action?: "install" | "disable";
  };

  const tenantId = body.tenantId ?? DEFAULT_TENANT_ID;
  const packageRef = body.packageRef;
  const action = body.action ?? "install";

  if (!packageRef || typeof packageRef !== "string") {
    return NextResponse.json({ error: "packageRef required" }, { status: 400 });
  }

  const agent = await ensureDefaultAgent(db, tenantId);

  try {
    if (action === "disable") {
      await disableCapabilityForAgent(db, {
        tenantId,
        agentId: agent.id,
        packageRef,
      });
      return NextResponse.json({ ok: true, status: "disabled" });
    }

    await installCapabilityForAgent(db, {
      tenantId,
      agentId: agent.id,
      packageRef,
    });
    return NextResponse.json({ ok: true, status: "installed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
