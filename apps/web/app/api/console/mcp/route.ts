import { db, mcpDiscoveredTools, mcpRegistry } from "@vela/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const servers = await db.select().from(mcpRegistry);
  const mapped = await Promise.all(
    servers.map(async (s) => {
      const tools = await db
        .select()
        .from(mcpDiscoveredTools)
        .where(eq(mcpDiscoveredTools.mcpId, s.id));
      return {
        id: s.id,
        name: s.name,
        status: s.lastHealthOk === false ? "failed" : "active",
        tools: tools.length,
        lastHealthCheck: s.lastHealthCheck?.toISOString() ?? null,
      };
    }),
  );
  return NextResponse.json({ servers: mapped });
}
