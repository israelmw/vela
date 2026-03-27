import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID } from "@vela/types";
import { syncAllMcpServersForTenant } from "../../../../lib/mcp-autosync";

/**
 * Scheduled MCP discovery (tools/list), registry sync, and tool bindings.
 * Vercel Cron: configure path + set CRON_SECRET; requests use Authorization: Bearer <secret>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
  const out = await syncAllMcpServersForTenant(tenantId);
  return NextResponse.json(out);
}
