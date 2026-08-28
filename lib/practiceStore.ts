"use client";

import type { PracticeAttempt, StoredScript } from "./types";

const CURRENT_SCRIPT_KEY = "vocalgym:current-script";
const ATTEMPTS_KEY = "vocalgym:attempts";
const MAX_ATTEMPTS = 50;

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
