import { db, agents, toolBindings } from "@vela/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(agents);
  const out = await Promise.all(
    rows.map(async (a) => {
      const skills = await db
        .select()
        .from(toolBindings)
        .where(eq(toolBindings.agentId, a.id));
      return {
        id: a.id,
        name: a.name,
        model: a.model,
        status: a.status,
        skills: skills.length,
      };
    }),
  );
  return NextResponse.json({ agents: out });
}
