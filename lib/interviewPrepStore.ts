"use client";

import { normalizePrep } from "./interviewPrep";
import type { InterviewPrepState } from "./types";

// Client access to the session's interview-prep setup (/api/interview-prep).
// Separate from lib/practiceStore.ts on purpose — different feature, different
// table, and it keeps prep data out of the /api/state hydration payload.

export async function loadInterviewPrep(): Promise<InterviewPrepState> {
  const res = await fetch("/api/interview-prep", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET /api/interview-prep -> ${res.status}`);
  return normalizePrep(await res.json());
}

export async function saveInterviewPrep(state: InterviewPrepState): Promise<void> {
  const res = await fetch("/api/interview-prep", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`PUT /api/interview-prep -> ${res.status}`);
}
