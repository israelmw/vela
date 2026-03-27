import { db, secretBindings } from "@vela/db";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await db
    .select({
      id: secretBindings.id,
      provider: secretBindings.provider,
      status: secretBindings.status,
      rotatedAt: secretBindings.rotatedAt,
      createdAt: secretBindings.createdAt,
    })
    .from(secretBindings)
    .orderBy(desc(secretBindings.createdAt))
    .limit(50);

  return NextResponse.json({
    secrets: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      status: r.status,
      rotatedAt: (r.rotatedAt ?? r.createdAt).toISOString(),
    })),
  });
}
