import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * When VELA_SITE_PASSWORD is set, require HTTP Basic Auth only for the admin
 * console and its API routes — not the public landing or other endpoints.
 * Optional VELA_SITE_USER (default: vela).
 *
 * Protected:
 * - /console, /console/*
 * - /api/console, /api/console/*
 *
 * Everything else (including /, webhooks, health, cron, other APIs) is not
 * gated by this env. Use app-level auth or Vercel protections if you need more.
 */
function requiresSitePassword(pathname: string): boolean {
  if (pathname === "/console" || pathname.startsWith("/console/")) {
    return true;
  }
  if (pathname === "/api/console" || pathname.startsWith("/api/console/")) {
    return true;
  }
  return false;
}

function safeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return n === 0;
}

function parseBasicAuth(
  header: string | null,
): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return {
      user: decoded.slice(0, idx),
      password: decoded.slice(idx + 1),
    };
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const password = process.env.VELA_SITE_PASSWORD;
  if (!password || password.length === 0) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (!requiresSitePassword(pathname)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.VELA_SITE_USER ?? "vela";
  const parsed = parseBasicAuth(req.headers.get("authorization"));
  if (
    parsed &&
    safeEqualStr(parsed.user, expectedUser) &&
    safeEqualStr(parsed.password, password)
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Vela", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|[^/]+\\.[^/]+$).*)",
  ],
};
