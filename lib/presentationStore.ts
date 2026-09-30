"use client";

import { normalizePresentationPrep } from "./presentationPrep";
import type { PresentationPrep, PresentationTake, PresentationTakeInput } from "./types";

// Client access to presentation mode's setup + take history.

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what} -> ${res.status}`);
  return res;
}

export async function loadPresentationPrep(): Promise<PresentationPrep> {
  const res = await ok(await fetch("/api/presentation-prep"), "GET /api/presentation-prep");
  return normalizePresentationPrep(await res.json());
}

/** `keepalive` lets the request outlive the page (flush on leave). */
export async function savePresentationPrep(
  prep: PresentationPrep,
  opts: { keepalive?: boolean } = {},
): Promise<void> {
  await ok(
    await fetch("/api/presentation-prep", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prep),
      keepalive: opts.keepalive,
    }),
    "PUT /api/presentation-prep",
  );
}

export async function loadTakes(): Promise<PresentationTake[]> {
  const res = await ok(await fetch("/api/presentation-takes"), "GET /api/presentation-takes");
  const data = await res.json();
  return Array.isArray(data) ? (data as PresentationTake[]) : [];
}

export async function saveTake(input: PresentationTakeInput): Promise<PresentationTake> {
  const res = await ok(
    await fetch("/api/presentation-takes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    "POST /api/presentation-takes",
  );
  return (await res.json()) as PresentationTake;
}

export async function deleteTake(id: string): Promise<void> {
  await ok(
    await fetch(`/api/presentation-takes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    "DELETE /api/presentation-takes",
  );
}
