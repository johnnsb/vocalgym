import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateEnabled, isValidGateCookie } from "@/lib/gate";

// Ensures every request carries an anonymous session id (cookie `vg_sid`),
// and — only when SITE_PASSWORD is set — a valid site-password gate cookie
// (`vg_gate`), redirecting to /gate otherwise.
// - existing vg_sid cookie: forwarded to route handlers via the `x-vg-sid` request header
// - missing vg_sid cookie: a new id is minted, forwarded on the header for *this*
//   request, and set as an httpOnly cookie on the response for future ones
//
// See lib/session.ts for vg_sid, lib/gate.ts for vg_gate. No DB work happens
// here (middleware runs on the edge) — the Session row is created lazily by
// the API routes via ensureSession().

const SESSION_COOKIE = "vg_sid";
const MAX_AGE = 60 * 60 * 24 * 365;

// Must stay reachable regardless of gate state, or a missing/invalid cookie
// would redirect to /gate, which would redirect to /gate, forever.
const GATE_EXEMPT_PATHS = new Set(["/gate", "/api/gate"]);

export async function middleware(req: NextRequest) {
  if (gateEnabled() && !GATE_EXEMPT_PATHS.has(req.nextUrl.pathname)) {
    const cookie = req.cookies.get(GATE_COOKIE)?.value;
    if (!(await isValidGateCookie(cookie))) {
      const gateUrl = new URL("/gate", req.url);
      gateUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(gateUrl);
    }
  }

  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  const id = existing || crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-vg-sid", id);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existing) {
    res.cookies.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}

export const config = {
  // Everything except Next internals, the Sentry tunnel, and static files.
  matcher: ["/((?!_next/static|_next/image|monitoring|favicon.ico).*)"],
};
