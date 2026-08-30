"use client";

import type {
  PracticeAttempt,
  RubricSelection,
  StoredScript,
  Tone,
} from "./types";
import { normalizeSelection, rubricPreset } from "./rubric";

// Client access to the session-scoped store (Postgres, via /api/state and
// /api/attempts). Was localStorage; the shape of what callers get back is the
// same. Every function that touches the server returns a Promise.

/** Same-tab signal: the tone/context dropdown changed. Detail is `Tone | ""`. */
export const TONE_CHANGE_EVENT = "vocalgym:tone-change";

/** Tell the rubric picker on this page that the tone changed, so it can retune. */
export function broadcastToneChange(tone: Tone | ""): void {
  try {
    window.dispatchEvent(new CustomEvent(TONE_CHANGE_EVENT, { detail: tone }));
  } catch {
    /* non-browser / no CustomEvent */
  }
}

export interface SessionState {
  currentScript: StoredScript | null;
  rubric: RubricSelection | null;
  attempts: PracticeAttempt[];
}

const EMPTY: SessionState = {
  currentScript: null,
  rubric: null,
  attempts: [],
};

// Tiny in-flight cache so that a page mounting two consumers (e.g. /generate
// renders GenerateFlow + RubricPicker) issues one GET, not two. Busted on write.
let cache: { at: number; promise: Promise<SessionState> } | null = null;
const CACHE_MS = 1500;

function coerceState(raw: unknown): SessionState {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as Partial<SessionState>;
  return {
    currentScript:
      r.currentScript && typeof r.currentScript === "object"
        ? (r.currentScript as StoredScript)
        : null,
    rubric:
      r.rubric && typeof r.rubric === "object"
        ? (r.rubric as RubricSelection)
        : null,
    attempts: Array.isArray(r.attempts)
      ? (r.attempts as PracticeAttempt[]).filter(
          (a) => a && typeof a.id === "string",
        )
      : [],
  };
}

/** Load the session's current script, rubric and attempts in one request. */
export function loadState(force = false): Promise<SessionState> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise = fetch("/api/state", {
    headers: { accept: "application/json" },
  })
    .then((r) => {
      if (!r.ok) throw new Error(`GET /api/state -> ${r.status}`);
      return r.json();
    })
    .then(coerceState)
    .catch((err) => {
      cache = null; // don't cache failures
      throw err;
    });
  cache = { at: Date.now(), promise };
  return promise;
}

function bustCache() {
  cache = null;
}

async function patchState(patch: {
  currentScript?: StoredScript | null;
  rubric?: RubricSelection | null;
}): Promise<void> {
  bustCache();
  const res = await fetch("/api/state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH /api/state -> ${res.status}`);
}

export function saveCurrentScript(entry: StoredScript): Promise<void> {
  return patchState({ currentScript: entry });
}

export function clearCurrentScript(): Promise<void> {
  return patchState({ currentScript: null });
}

export function saveRubric(selection: RubricSelection): Promise<void> {
  return patchState({ rubric: selection });
}

export interface NewAttempt {
  script: string;
  situation: string;
  tone: Tone | "";
  transcript: string;
  feedback: string;
  nonverbal?: PracticeAttempt["nonverbal"];
  effective?: PracticeAttempt["effective"];
}

/** Save a rehearsal attempt; resolves to the stored row (with id + createdAt). */
export async function addAttempt(input: NewAttempt): Promise<PracticeAttempt> {
  bustCache();
  const res = await fetch("/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`POST /api/attempts -> ${res.status}`);
  const data = (await res.json()) as { attempt: PracticeAttempt };
  return data.attempt;
}

export async function deleteAttempt(id: string): Promise<void> {
  bustCache();
  const res = await fetch(`/api/attempts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`DELETE /api/attempts/${id} -> ${res.status}`);
}

export async function clearAttempts(): Promise<void> {
  bustCache();
  const res = await fetch("/api/attempts", { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/attempts -> ${res.status}`);
}

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The rubric to actually score against: the user's hand-edited one if they made
 * it, otherwise the preset for whatever tone the current script carries.
 */
export function resolveRubric(state: SessionState): RubricSelection {
  if (state.rubric?.custom) return normalizeSelection(state.rubric);
  return rubricPreset(state.currentScript?.tone ?? "");
}
