// Site-wide password gate. Pure logic, no React — used from middleware.ts
// (Edge runtime) and app/api/gate/route.ts (Node runtime), so this sticks to
// Web Crypto's `crypto.subtle` rather than `node:crypto`, which the Edge
// runtime doesn't have.

export const GATE_COOKIE = "vg_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — "long-lived"

/** Unset/blank SITE_PASSWORD fully bypasses the gate — e.g. local dev, where
 *  .env.local has no reason to set it. */
export function gateEnabled(): boolean {
  return Boolean(process.env.SITE_PASSWORD);
}

/** Salted SHA-256 hex digest. The cookie stores this, never the plaintext
 *  password — middleware recomputes it fresh from SITE_PASSWORD on every
 *  request rather than persisting or looking anything up. */
async function digest(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`vocalgym-gate:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a correct password should produce. */
export function gateTokenFor(password: string): Promise<string> {
  return digest(password);
}

/** Does this request's `vg_gate` cookie match the current SITE_PASSWORD?
 *  Always false when the gate is disabled — callers should check
 *  gateEnabled() first to decide whether to bypass entirely, rather than
 *  relying on this returning true. */
export async function isValidGateCookie(
  cookieValue: string | undefined | null,
): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password || !cookieValue) return false;
  return cookieValue === (await digest(password));
}

/** Does the submitted password match SITE_PASSWORD? */
export function checkPassword(submitted: string): boolean {
  const password = process.env.SITE_PASSWORD;
  return Boolean(password) && submitted === password;
}

/** Guards against an open redirect via `?next=` — only a same-site path is
 *  ever honored. Anything else (absolute URL, protocol-relative `//host`,
 *  backslash tricks, missing) falls back to "/". */
export function sanitizeNextPath(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
