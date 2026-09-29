"use client";

// POST-JSON helper for the interview-prep client. Same behavior as the private
// helper in GrillSession (left as-is): maps the shared demo-cap 429 to a
// friendly, flagged error.

export const DEMO_LIMIT_MESSAGE =
  "This demo has hit its usage limit for now. Thanks for trying VocalGym — please check back later.";

export interface FetchError extends Error {
  demoLimited?: boolean;
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (res.status === 429 && data.code === "demo_limit_reached") {
    const err: FetchError = new Error(DEMO_LIMIT_MESSAGE);
    err.demoLimited = true;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}
