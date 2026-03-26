import { db } from "@vela/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.execute(sql`select 1 as v`);
    return NextResponse.json({ ok: true, database: "up" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, database: "down", error: message },
      { status: 503 },
    );
  }
}
