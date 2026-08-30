import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";

// Anonymous per-browser identity. The app has no accounts yet, so a random id in
// an httpOnly cookie is "the user". `middleware.ts` guarantees the cookie exists
// on every request and forwards the value in the `x-vg-sid` header so that even
// the first request (where the cookie is only in the *response*) can read it.

export const SESSION_COOKIE = "vg_sid";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** The current browser's session id. Falls back to a fresh id if middleware
 *  somehow didn't run (the row is still created lazily by ensureSession). */
export function getSessionId(): string {
  const fromHeader = headers().get("x-vg-sid");
  if (fromHeader) return fromHeader;
  const fromCookie = cookies().get(SESSION_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  return crypto.randomUUID();
}

/** Make sure a Session row exists for this id, then return the id. */
export async function ensureSession(id: string): Promise<string> {
  await prisma.session.upsert({
    where: { id },
    create: { id },
    update: {},
  });
  return id;
}
