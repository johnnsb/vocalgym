import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, checkPassword, gateTokenFor } from "@/lib/gate";
import { logInfo, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "gate";

export async function POST(request: Request) {
  const rid = newRequestId();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = (payload ?? {}) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    logInfo(SCOPE, rid, "incorrect password");
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateTokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  logInfo(SCOPE, rid, "unlocked");
  return res;
}
