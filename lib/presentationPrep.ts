import type {
  EffectiveResult,
  NonverbalMetrics,
  PresentationPrep,
  PresentationSlide,
  PresentationTakeInput,
  SlideTiming,
} from "./types";

// Pure normalization for presentation mode (app/prep/presentation). Used by
// the server before storing / prompting and by the client when hydrating and
// importing. No Prisma/React/DOM, so it's unit-testable and safe on both sides.

export const PRESENTATION_LIMITS = {
  title: 120,
  notes: 12_000,
  slidesMax: 40,
  slideTitle: 200,
  slideNotes: 2_000,
  slideNotesTotal: 20_000,
  audience: 2_000,
  timeLimitMinMin: 1,
  timeLimitMinMax: 120,
  transcript: 12_000,
  feedback: 40_000,
  durationSecMax: 10_800,
  id: 100,
} as const;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function clampInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n < min || n > max ? null : n;
}

export function emptyPresentationPrep(): PresentationPrep {
  return { title: "", mode: "notes", notes: "", slides: [], audience: "", timeLimitMin: null };
}

/** ≤40 slides; combined notes ≤20,000 chars with later slides cut first
 *  (titles always kept). `truncated` tells the UI to show a note. */
export function capSlides(slides: PresentationSlide[]): {
  slides: PresentationSlide[];
  truncated: boolean;
} {
  let truncated = slides.length > PRESENTATION_LIMITS.slidesMax;
  let budget = PRESENTATION_LIMITS.slideNotesTotal;
  const out = slides.slice(0, PRESENTATION_LIMITS.slidesMax).map((s) => {
    const notes = s.notes.slice(0, Math.max(0, budget));
    if (notes.length < s.notes.length) truncated = true;
    budget -= notes.length;
    return { ...s, notes };
  });
  return { slides: out, truncated };
}

function normalizeSlides(v: unknown): PresentationSlide[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const slides = v.slice(0, PRESENTATION_LIMITS.slidesMax).map((raw, i) => {
    const s = obj(raw);
    const base = str(s.id, PRESENTATION_LIMITS.id).trim() || `s${i + 1}`;
    let id = base;
    for (let n = i + 1; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    return {
      id,
      title: str(s.title, PRESENTATION_LIMITS.slideTitle),
      notes: str(s.notes, PRESENTATION_LIMITS.slideNotes),
    };
  });
  return capSlides(slides).slides;
}

/** Validate/truncate an untrusted setup blob. Never throws. */
export function normalizePresentationPrep(input: unknown): PresentationPrep {
  const r = obj(input);
  return {
    title: str(r.title, PRESENTATION_LIMITS.title),
    mode: r.mode === "slides" ? "slides" : "notes",
    notes: str(r.notes, PRESENTATION_LIMITS.notes),
    slides: normalizeSlides(r.slides),
    audience: str(r.audience, PRESENTATION_LIMITS.audience),
    timeLimitMin: clampInt(
      r.timeLimitMin,
      PRESENTATION_LIMITS.timeLimitMinMin,
      PRESENTATION_LIMITS.timeLimitMinMax,
    ),
  };
}

/** Is there anything to present in the ACTIVE mode? (Start gate + route 400.) */
export function presentationHasContent(prep: PresentationPrep): boolean {
  if (prep.mode === "notes") return prep.notes.trim().length > 0;
  return prep.slides.some((s) => s.title.trim() || s.notes.trim());
}

/** Keep timings for slides that still exist; whole seconds, clamped. */
export function normalizeSlideTimings(
  input: unknown,
  slides: PresentationSlide[],
): SlideTiming[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set(slides.map((s) => s.id));
  const out: SlideTiming[] = [];
  for (const raw of input) {
    if (out.length >= PRESENTATION_LIMITS.slidesMax) break;
    const t = obj(raw);
    if (typeof t.slideId !== "string" || !ids.has(t.slideId)) continue;
    if (typeof t.seconds !== "number" || !Number.isFinite(t.seconds) || t.seconds < 0) continue;
    out.push({
      slideId: t.slideId,
      seconds: Math.min(Math.round(t.seconds), PRESENTATION_LIMITS.durationSecMax),
    });
  }
  return out;
}

/** Validate a take before storing. null = unusable (no transcript/feedback). */
export function normalizeTakeInput(input: unknown): PresentationTakeInput | null {
  const r = obj(input);
  const transcript = str(r.transcript, PRESENTATION_LIMITS.transcript);
  const feedback = str(r.feedback, PRESENTATION_LIMITS.feedback);
  if (!transcript.trim() || !feedback.trim()) return null;
  const duration =
    typeof r.durationSec === "number" && Number.isFinite(r.durationSec)
      ? Math.min(Math.max(Math.round(r.durationSec), 0), PRESENTATION_LIMITS.durationSecMax)
      : 0;
  const timings = Array.isArray(r.slideTimings)
    ? r.slideTimings
        .map(obj)
        .filter((t) => typeof t.slideId === "string" && typeof t.seconds === "number" && Number.isFinite(t.seconds))
        .slice(0, PRESENTATION_LIMITS.slidesMax)
        .map((t) => ({
          slideId: (t.slideId as string).slice(0, PRESENTATION_LIMITS.id),
          seconds: Math.min(Math.max(Math.round(t.seconds as number), 0), PRESENTATION_LIMITS.durationSecMax),
        }))
    : null;
  const effective = r.effective && typeof r.effective === "object" ? (r.effective as EffectiveResult) : null;
  const nonverbal = r.nonverbal && typeof r.nonverbal === "object" ? (r.nonverbal as NonverbalMetrics) : null;
  return {
    talkTitle: str(r.talkTitle, PRESENTATION_LIMITS.title),
    durationSec: duration,
    transcript,
    feedback,
    effective,
    nonverbal,
    slideTimings: timings,
  };
}

/** Seconds on each slide within [startAt, stopAt] (ms timestamps). `changes`
 *  is every slide change since the run view opened, oldest first; the first
 *  entry is the slide shown on open. The slide showing at startAt gets the
 *  first interval; changes outside the window are ignored; revisits add up.
 *  Output is in first-shown order, whole seconds. */
export function accumulateTimings(
  changes: { slideId: string; at: number }[],
  startAt: number,
  stopAt: number,
): SlideTiming[] {
  if (!changes.length || stopAt <= startAt) return [];
  const sorted = [...changes].sort((a, b) => a.at - b.at);
  let current = sorted[0].slideId;
  for (const c of sorted) if (c.at <= startAt) current = c.slideId;
  const totals = new Map<string, number>();
  let from = startAt;
  for (const c of sorted) {
    if (c.at <= startAt) continue;
    if (c.at >= stopAt) break;
    totals.set(current, (totals.get(current) ?? 0) + (c.at - from));
    current = c.slideId;
    from = c.at;
  }
  totals.set(current, (totals.get(current) ?? 0) + (stopAt - from));
  return Array.from(totals.entries()).map(([slideId, ms]) => ({ slideId, seconds: Math.round(ms / 1000) }));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
