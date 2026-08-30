"use client";

import type {
  PracticeAttempt,
  RubricSelection,
  StoredScript,
  Tone,
} from "./types";
import { normalizeSelection, rubricPreset } from "./rubric";

const CURRENT_SCRIPT_KEY = "vocalgym:current-script";
const ATTEMPTS_KEY = "vocalgym:attempts";
const RUBRIC_KEY = "vocalgym:rubric";
const MAX_ATTEMPTS = 50;

/** Same-tab signal: the tone/context dropdown changed. Detail is `Tone | ""`. */
export const TONE_CHANGE_EVENT = "vocalgym:tone-change";

/** Tell the rubric picker on this page that the tone changed, so it can retune. */
export function broadcastToneChange(tone: Tone | ""): void {
  try {
    window.dispatchEvent(new CustomEvent(TONE_CHANGE_EVENT, { detail: tone }));
  } catch {
    /* non-browser / no CustomEvent — picker still reads it on next load */
  }
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveCurrentScript(entry: StoredScript): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CURRENT_SCRIPT_KEY, JSON.stringify(entry));
  } catch {
    /* quota or serialization failure — non-fatal */
  }
}

export function loadCurrentScript(): StoredScript | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(CURRENT_SCRIPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredScript>;
    if (typeof parsed.script !== "string" || !parsed.script) return null;
    return {
      script: parsed.script,
      situation: typeof parsed.situation === "string" ? parsed.situation : "",
      tone:
        parsed.tone === "" || typeof parsed.tone === "string"
          ? (parsed.tone as StoredScript["tone"])
          : "",
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      source: parsed.source === "uploaded" ? "uploaded" : "generated",
    };
  } catch {
    return null;
  }
}

export function loadAttempts(): PracticeAttempt[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttempt).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: PracticeAttempt): PracticeAttempt[] {
  const next = [attempt, ...loadAttempts()].slice(0, MAX_ATTEMPTS);
  writeAttempts(next);
  return next;
}

export function deleteAttempt(id: string): PracticeAttempt[] {
  const next = loadAttempts().filter((a) => a.id !== id);
  writeAttempts(next);
  return next;
}

export function clearAttempts(): void {
  writeAttempts([]);
}

function writeAttempts(attempts: PracticeAttempt[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    /* non-fatal */
  }
}

function isAttempt(value: unknown): value is PracticeAttempt {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.script === "string" &&
    typeof v.transcript === "string" &&
    typeof v.feedback === "string"
  );
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

/** The effectiveness rubric the user last set on the home page. */
export function saveRubric(selection: RubricSelection): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(RUBRIC_KEY, JSON.stringify(selection));
  } catch {
    /* non-fatal */
  }
}

/** Returns the raw stored selection (may be empty); `null` if nothing saved. */
export function loadRubric(): RubricSelection | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(RUBRIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RubricSelection>;
    if (!Array.isArray(parsed.attributes)) return null;
    return {
      attributes: parsed.attributes.slice(0, 4) as RubricSelection["attributes"],
      weights:
        parsed.weights && typeof parsed.weights === "object"
          ? (parsed.weights as Record<string, number>)
          : {},
      custom: parsed.custom === true,
    };
  } catch {
    return null;
  }
}

/** Same as loadRubric but always returns a usable, weight-normalised selection. */
export function loadRubricNormalized(): RubricSelection {
  return normalizeSelection(loadRubric());
}

/**
 * The rubric to actually score against: the user's hand-edited one if they made
 * it, otherwise the preset for whatever tone they picked for the current script.
 */
export function resolveRubric(): RubricSelection {
  const stored = loadRubric();
  if (stored?.custom) return normalizeSelection(stored);
  return rubricPreset(loadCurrentScript()?.tone ?? "");
}
