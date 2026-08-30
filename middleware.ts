import { NextResponse, type NextRequest } from "next/server";

// Ensures every request carries an anonymous session id (cookie `vg_sid`).
// - existing cookie: forwarded to route handlers via the `x-vg-sid` request header
// - missing cookie: a new id is minted, forwarded on the header for *this*
//   request, and set as an httpOnly cookie on the response for future ones
//
// See lib/session.ts. No DB work happens here (middleware runs on the edge) —
// the Session row is created lazily by the API routes via ensureSession().

const SESSION_COOKIE = "vg_sid";
const MAX_AGE = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
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
