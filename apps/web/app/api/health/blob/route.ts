import { NextResponse } from "next/server";

export async function GET() {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return NextResponse.json({
    ok: hasToken,
    blob: hasToken ? "token_configured" : "missing_BLOB_READ_WRITE_TOKEN",
  });
}
