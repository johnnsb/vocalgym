import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureSession } from "./session";
import { TONES, type PracticeAttempt, type RubricSelection, type StoredScript, type Tone } from "./types";

// Server-side data access for everything that used to live in localStorage:
// the session's single "current script", its rubric selection, and its
// rehearsal attempts. All reads/writes are scoped to a session id.

const MAX_ATTEMPTS = 50;
const LIMITS = { script: 8000, situation: 2000, tone: 40, transcript: 12000, feedback: 40000 };

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function asTone(v: unknown): Tone | "" {
  return typeof v === "string" && (TONES as readonly string[]).includes(v)
    ? (v as Tone)
    : "";
}

function asJsonObject(v: unknown): Prisma.InputJsonValue | null {
  return v !== null && typeof v === "object" ? (v as Prisma.InputJsonValue) : null;
}

/** Normalize an untrusted currentScript blob (or null) for storage/return. */
export function normalizeStoredScript(v: unknown): StoredScript | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<StoredScript>;
  if (typeof p.script !== "string" || !p.script.trim()) return null;
  return {
    script: p.script.slice(0, LIMITS.script),
    situation: asString(p.situation, LIMITS.situation),
    tone: asTone(p.tone),
    savedAt: typeof p.savedAt === "number" ? p.savedAt : Date.now(),
    source: p.source === "uploaded" ? "uploaded" : "generated",
  };
}

/** Normalize an untrusted rubric blob (or null) for storage/return. */
export function normalizeRubricSelection(v: unknown): RubricSelection | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<RubricSelection>;
  if (!Array.isArray(p.attributes)) return null;
  return {
    attributes: p.attributes.slice(0, 4) as RubricSelection["attributes"],
    weights:
      p.weights && typeof p.weights === "object"
        ? (p.weights as Record<string, number>)
        : {},
    custom: p.custom === true,
  };
}

type AttemptRow = {
  id: string;
  createdAt: Date;
  script: string;
  situation: string;
  tone: string;
  transcript: string;
  feedback: string;
  nonverbal: Prisma.JsonValue;
  effective: Prisma.JsonValue;
};

function rowToAttempt(r: AttemptRow): PracticeAttempt {
  return {
    id: r.id,
    createdAt: r.createdAt.getTime(),
    script: r.script,
    situation: r.situation,
    tone: asTone(r.tone),
    transcript: r.transcript,
    feedback: r.feedback,
    nonverbal: (r.nonverbal ?? null) as PracticeAttempt["nonverbal"],
    effective: (r.effective ?? null) as PracticeAttempt["effective"],
  };
}

export interface SessionState {
  currentScript: StoredScript | null;
  rubric: RubricSelection | null;
  attempts: PracticeAttempt[];
}

export async function getState(sessionId: string): Promise<SessionState> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      attempts: { orderBy: { createdAt: "desc" }, take: MAX_ATTEMPTS },
    },
  });
  return {
    currentScript: normalizeStoredScript(s?.currentScript ?? null),
    rubric: normalizeRubricSelection(s?.rubric ?? null),
    attempts: (s?.attempts ?? []).map(rowToAttempt),
  };
}

type JsonField = Prisma.InputJsonValue | typeof Prisma.DbNull;

function toJsonField(v: object | null): JsonField {
  return v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue);
}

export async function patchState(
  sessionId: string,
  patch: { currentScript?: unknown; rubric?: unknown },
): Promise<void> {
  const fields: { currentScript?: JsonField; rubric?: JsonField } = {};

  if ("currentScript" in patch) {
    fields.currentScript = toJsonField(
      patch.currentScript === null
        ? null
        : normalizeStoredScript(patch.currentScript),
    );
  }
  if ("rubric" in patch) {
    fields.rubric = toJsonField(
      patch.rubric === null ? null : normalizeRubricSelection(patch.rubric),
    );
  }
  if (Object.keys(fields).length === 0) return;

  await prisma.session.upsert({
    where: { id: sessionId },
    create: { id: sessionId, ...fields },
    update: { ...fields },
  });
}

export interface AttemptInput {
  script: unknown;
  situation?: unknown;
  tone?: unknown;
  transcript: unknown;
  feedback: unknown;
  nonverbal?: unknown;
  effective?: unknown;
}

export async function addAttempt(
  sessionId: string,
  input: AttemptInput,
): Promise<PracticeAttempt> {
  const script = asString(input.script, LIMITS.script);
  const transcript = asString(input.transcript, LIMITS.transcript);
  const feedback = asString(input.feedback, LIMITS.feedback);
  if (!script.trim() || !transcript.trim() || !feedback.trim()) {
    throw new Error("attempt requires script, transcript and feedback");
  }

  await ensureSession(sessionId);

  const nv = asJsonObject(input.nonverbal ?? null);
  const eff = asJsonObject(input.effective ?? null);

  const row = await prisma.attempt.create({
    data: {
      sessionId,
      script,
      situation: asString(input.situation, LIMITS.situation),
      tone: asTone(input.tone),
      transcript,
      feedback,
      nonverbal: nv === null ? Prisma.DbNull : nv,
      effective: eff === null ? Prisma.DbNull : eff,
    },
  });

  // Keep only the newest MAX_ATTEMPTS for this session.
  const stale = await prisma.attempt.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    skip: MAX_ATTEMPTS,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.attempt.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  }

  return rowToAttempt(row);
}

export async function removeAttempt(
  sessionId: string,
  id: string,
): Promise<void> {
  await prisma.attempt.deleteMany({ where: { id, sessionId } });
}

export async function clearAttempts(sessionId: string): Promise<void> {
  await prisma.attempt.deleteMany({ where: { sessionId } });
}
