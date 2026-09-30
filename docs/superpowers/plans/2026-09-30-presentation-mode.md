# Presentation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/prep/presentation` — rehearse a talk from speaker notes or an imported `.pptx` as one continuous run-through, get an Effective score plus coverage-focused Claude feedback, and keep a history of takes.

**Architecture:** An isolated feature beside `/prep/interview`. Setup persists in a `PresentationPrep` table and each take in `PresentationTake` (never `Attempt`). One Claude route (`/api/presentation-feedback`) follows the existing route pattern (logger + Sentry + usage cap + `verifyOutput`). Scoring reuses `computeSignals`/`computeEffective` with a fixed `PRESENTATION_RUBRIC`. `.pptx` is parsed in the browser with `fflate` + pure string helpers. Pure logic lives in `lib/` and is unit-tested with Vitest.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 6 / Neon Postgres, `@anthropic-ai/sdk`, Tailwind + `components/ui`, Vitest 3, `fflate` (new), PostHog via `lib/analytics.ts`.

**Spec:** `docs/superpowers/specs/2026-09-30-presentation-mode-design.md`

## Global Constraints

- Additive/isolated: do NOT change behavior of `/script`, `/generate`, `/practice`, `/grill`, `/prep/interview`. Existing files get additive edits only: `lib/types.ts`, `lib/rubric.ts`, `lib/prompt.ts`, `lib/anthropic.ts`, `lib/verifyOutput.ts`, `lib/analytics.ts` (`EVENTS`), `prisma/schema.prisma`, `app/prep/page.tsx` (Presentation card → link), `package.json`, `CLAUDE.md`, `README.md`.
- `PRESENTATION_RUBRIC` is NOT a `Tone` — do not touch `TONES`, `TONE_LABELS`, `TONE_RUBRIC_PRESETS`, `TONE_GUIDANCE`.
- Presentation takes are stored ONLY in `PresentationTake`; never in `Attempt`.
- Style with `components/ui` primitives + token utilities; notices via `<Callout tone="info" | "caution" | "critical">`; icons only from the `Icon` REGISTRY (`presentation`, `upload`, `arrow-left`, `arrow-right`, `trash-2`, `chevron-down`, `chevron-right`, `rotate-ccw`, `clock`). No browser dialogs (`confirm`/`alert`).
- Analytics props are primitives only; never send notes, slide text, audience, transcripts or feedback to `track()`.
- Server DB access only via `prisma` from `lib/prisma.ts`.
- Limits (verbatim from spec): title/talkTitle 120; notes 12,000; slides ≤40, slide title 200, slide notes 2,000; all slide notes combined 20,000 (later slides' notes cut first); audience 2,000; timeLimitMin integer 1–120 else null; mode `"notes"`|`"slides"` default `"notes"`; transcript 12,000; feedback 40,000; durationSec integer 0–10,800; slideTimings ≤40 entries, seconds 0–10,800, unknown slide ids dropped. Over-limit text is truncated, not rejected.
- `PRESENTATION_RUBRIC`: Clear 30 · Confident 25 · Connected 25 · Smooth 20, `custom: false`.
- Feedback sections (bold headings, this order): Overall / Coverage / Flow & timing / Delivery / Nonverbal (camera only) / For your next run. Missing required section → 502 `code: "feedback_incomplete"`.
- Take history: newest 50 per session.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The local post-commit hook pushes the branch (`feature/presentation-mode`) on every commit.

## Review Focus

1. **Deck whose internal file order differs from presentation order** (e.g. `slide10.xml` listed before `slide2.xml`, or slides reordered in PowerPoint) — import must follow `p:sldIdLst`, not file names. Pinned in Task 2 (`slideOrder` test).
2. **Slides edited or deleted after a take / timings for slides that no longer exist** — timings with unknown slide ids are dropped before prompting; nothing renders "S? undefined". Pinned in Task 1 (`normalizeSlideTimings` test).
3. **Stepping slides before pressing record, or clicking prev/next rapidly while recording** — only time inside the recording window counts, revisits add up, and the slide showing when recording started gets the first interval. Pinned in Task 1 (`accumulateTimings` tests).
4. **Slides mode where every slide is blank** — Start stays disabled and the route returns 400 rather than asking Claude to review nothing. Pinned in Task 1 (`presentationHasContent`) and Task 4 (route 400 check).
5. **Huge real-world deck (60 slides, 50k chars of notes, `&amp;` / `&#8217;` in text)** — trimmed to 40 slides / 20,000 notes chars with a note, later slides cut first, entities decoded. Pinned in Task 1 (`capSlides`) and Task 2 (entity + truncation tests).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/types.ts` | modify (append) | Presentation types |
| `lib/presentationPrep.ts` | create | Pure: limits, defaults, `normalizePresentationPrep`, `capSlides`, `normalizeSlideTimings`, `normalizeTakeInput`, `presentationHasContent`, `accumulateTimings`, `formatDuration` |
| `lib/presentationPrep.test.ts` | create | Tests for the above |
| `lib/rubric.ts` | modify (append) | `PRESENTATION_RUBRIC` |
| `lib/rubric.presentation.test.ts` | create | Preset test |
| `lib/pptxImport.ts` | create | `.pptx` → slides (fflate + pure XML string helpers) |
| `lib/pptxImport.test.ts` | create | Parser tests + in-memory `.pptx` end-to-end |
| `prisma/schema.prisma` | modify | `PresentationPrep`, `PresentationTake` + `Session` relations |
| `prisma/migrations/<ts>_presentation_mode/` | generated | Migration |
| `lib/presentationPrep.server.ts` | create | Prisma access: prep get/save, takes list/add/remove |
| `app/api/presentation-prep/route.ts` | create | GET / PUT |
| `app/api/presentation-takes/route.ts` | create | GET / POST |
| `app/api/presentation-takes/[id]/route.ts` | create | DELETE |
| `lib/presentationStore.ts` | create | Client fetch wrappers |
| `lib/prompt.ts` | modify (append) | `PRESENTATION_FEEDBACK_SYSTEM_PROMPT`, `buildPresentationFeedbackPrompt` |
| `lib/prompt.presentation.test.ts` | create | Prompt tests |
| `lib/verifyOutput.ts` | modify (append) | `verifyPresentationFeedback` |
| `lib/verifyOutput.presentation.test.ts` | create | Verifier tests |
| `lib/anthropic.ts` | modify (append) | `generatePresentationFeedback` |
| `app/api/presentation-feedback/route.ts` | create | Feedback route |
| `lib/analytics.ts` | modify | 3 `EVENTS` |
| `components/PresentationSetup.tsx` | create | Title, mode switch, notes + upload, audience, time limit |
| `components/SlideListEditor.tsx` | create | `.pptx` import + editable slide rows |
| `components/PresentationRun.tsx` | create | Slide stepper + recorder + transcript + live score |
| `components/PresentationFeedbackSections.tsx` | create | Feedback renderer |
| `components/PresentationHistory.tsx` | create | Take list |
| `components/PresentationSession.tsx` | create | State machine, load/save, API calls, analytics |
| `app/prep/presentation/page.tsx` | create | Page shell |
| `app/prep/page.tsx` | modify | Presentation card → live link |
| `CLAUDE.md`, `README.md` | modify | Docs |

---

### Task 1: Types, pure normalization, timings, rubric preset

**Files:**
- Modify: `lib/types.ts` (append), `lib/rubric.ts` (append)
- Create: `lib/presentationPrep.ts`, `lib/presentationPrep.test.ts`, `lib/rubric.presentation.test.ts`

**Interfaces:**
- Consumes: `RUBRIC_ATTRIBUTES`, `RubricSelection`, `EffectiveResult`, `NonverbalMetrics` (`lib/types.ts`).
- Produces:
  - types `PresentationSlide`, `PresentationMode`, `PresentationPrep`, `SlideTiming`, `PresentationTake`, `PresentationTakeInput`, `PresentationFeedbackRequest`, `PresentationFeedbackResponse`
  - `lib/presentationPrep.ts`: `PRESENTATION_LIMITS`, `emptyPresentationPrep(): PresentationPrep`, `capSlides(slides: PresentationSlide[]): { slides: PresentationSlide[]; truncated: boolean }`, `normalizePresentationPrep(input: unknown): PresentationPrep`, `normalizeSlideTimings(input: unknown, slides: PresentationSlide[]): SlideTiming[]`, `normalizeTakeInput(input: unknown): PresentationTakeInput | null`, `presentationHasContent(prep: PresentationPrep): boolean`, `accumulateTimings(changes: { slideId: string; at: number }[], startAt: number, stopAt: number): SlideTiming[]`, `formatDuration(seconds: number): string`
  - `lib/rubric.ts`: `PRESENTATION_RUBRIC: RubricSelection`

Note (plan ruling vs. spec): the spec sketched `accumulateTimings(events, stopAt)`. `PracticeRecorder` exposes no start event, so the start is derived as `stopAt - durationSec*1000` in the UI and passed in; `changes` is every slide change since the run view opened (first entry = slide shown on open). `PresentationTake.createdAt` is epoch ms (`number`), matching `PracticeAttempt.createdAt`, not an ISO string.

- [ ] **Step 1: Append types to `lib/types.ts`**

```ts
/**
 * Presentation mode (app/prep/presentation) — rehearse a talk from speaker
 * notes or an imported .pptx as one continuous take. Scored with the shared
 * Effective score (PRESENTATION_RUBRIC in lib/rubric.ts); takes are stored in
 * their own table, never as practice Attempts.
 */
export interface PresentationSlide {
  id: string;
  title: string;
  notes: string;
}

export type PresentationMode = "notes" | "slides";

export interface PresentationPrep {
  title: string;
  mode: PresentationMode;
  notes: string;
  slides: PresentationSlide[];
  audience: string;
  timeLimitMin: number | null;
}

export interface SlideTiming {
  slideId: string;
  seconds: number;
}

export interface PresentationTakeInput {
  talkTitle: string;
  durationSec: number;
  transcript: string;
  feedback: string;
  effective: EffectiveResult | null;
  nonverbal: NonverbalMetrics | null;
  slideTimings: SlideTiming[] | null;
}

export interface PresentationTake extends PresentationTakeInput {
  id: string;
  /** epoch ms, like PracticeAttempt.createdAt */
  createdAt: number;
}

export interface PresentationFeedbackRequest {
  prep: PresentationPrep;
  transcript: string;
  durationSec: number;
  slideTimings: SlideTiming[] | null;
  nonverbal: NonverbalMetrics | null;
  signals: ObservableSignals | null;
}

export interface PresentationFeedbackResponse {
  feedback: string;
}
```

- [ ] **Step 2: Write failing tests** — create `lib/presentationPrep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PRESENTATION_LIMITS,
  accumulateTimings,
  capSlides,
  emptyPresentationPrep,
  formatDuration,
  normalizePresentationPrep,
  normalizeSlideTimings,
  normalizeTakeInput,
  presentationHasContent,
} from "./presentationPrep";

const slide = (id: string, title = "", notes = "") => ({ id, title, notes });

describe("normalizePresentationPrep", () => {
  it("returns defaults for junk input", () => {
    for (const input of [null, undefined, 1, "x", [], {}]) {
      expect(normalizePresentationPrep(input)).toEqual(emptyPresentationPrep());
    }
    expect(emptyPresentationPrep()).toEqual({
      title: "", mode: "notes", notes: "", slides: [], audience: "", timeLimitMin: null,
    });
  });

  it("truncates text fields to their limits", () => {
    const long = "x".repeat(30_000);
    const p = normalizePresentationPrep({
      title: long, notes: long, audience: long,
      slides: [{ id: "a", title: long, notes: long }],
    });
    expect(p.title).toHaveLength(120);
    expect(p.notes).toHaveLength(12_000);
    expect(p.audience).toHaveLength(2_000);
    expect(p.slides[0].title).toHaveLength(200);
    expect(p.slides[0].notes).toHaveLength(2_000);
  });

  it("accepts only the two modes", () => {
    expect(normalizePresentationPrep({ mode: "slides" }).mode).toBe("slides");
    expect(normalizePresentationPrep({ mode: "video" }).mode).toBe("notes");
  });

  it("keeps time limits of 1-120 whole minutes, else null", () => {
    expect(normalizePresentationPrep({ timeLimitMin: 10 }).timeLimitMin).toBe(10);
    expect(normalizePresentationPrep({ timeLimitMin: 7.6 }).timeLimitMin).toBe(8);
    for (const bad of [0, -3, 121, "10", NaN, null]) {
      expect(normalizePresentationPrep({ timeLimitMin: bad }).timeLimitMin).toBeNull();
    }
  });

  it("gives every slide a unique id", () => {
    const p = normalizePresentationPrep({ slides: [{ title: "A" }, { id: "x" }, { id: "x" }, { id: "x-3" }] });
    const ids = p.slides.map((s) => s.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("capSlides", () => {
  it("keeps at most 40 slides", () => {
    const many = Array.from({ length: 60 }, (_, i) => slide(`s${i}`, `T${i}`));
    const r = capSlides(many);
    expect(r.slides).toHaveLength(PRESENTATION_LIMITS.slidesMax);
    expect(r.truncated).toBe(true);
  });

  it("caps combined notes at 20,000 chars, cutting later slides first", () => {
    const deck = Array.from({ length: 12 }, (_, i) => slide(`s${i}`, `T${i}`, "n".repeat(2_000)));
    const r = capSlides(deck);
    const total = r.slides.reduce((n, s) => n + s.notes.length, 0);
    expect(total).toBe(20_000);
    expect(r.slides[0].notes).toHaveLength(2_000);
    expect(r.slides[9].notes).toHaveLength(2_000);
    expect(r.slides[10].notes).toBe("");
    expect(r.slides[11].notes).toBe("");
    expect(r.slides[11].title).toBe("T11"); // titles are kept
    expect(r.truncated).toBe(true);
  });

  it("reports no truncation for a normal deck", () => {
    expect(capSlides([slide("a", "A", "hi")])).toEqual({ slides: [slide("a", "A", "hi")], truncated: false });
  });
});

describe("presentationHasContent", () => {
  it("checks only the active mode", () => {
    const p = emptyPresentationPrep();
    expect(presentationHasContent(p)).toBe(false);
    expect(presentationHasContent({ ...p, notes: "  point one " })).toBe(true);
    expect(presentationHasContent({ ...p, mode: "slides", notes: "point one" })).toBe(false);
  });
  it("needs at least one slide with a title or notes in slides mode", () => {
    const p = { ...emptyPresentationPrep(), mode: "slides" as const };
    expect(presentationHasContent({ ...p, slides: [slide("a"), slide("b", "  ")] })).toBe(false);
    expect(presentationHasContent({ ...p, slides: [slide("a"), slide("b", "", "notes")] })).toBe(true);
  });
});

describe("normalizeSlideTimings", () => {
  const slides = [slide("a", "A"), slide("b", "B")];
  it("drops timings for slides that no longer exist and bad values", () => {
    expect(
      normalizeSlideTimings(
        [
          { slideId: "a", seconds: 12.4 },
          { slideId: "gone", seconds: 5 },
          { slideId: "b", seconds: -1 },
          { slideId: "b", seconds: "3" },
          null,
        ],
        slides,
      ),
    ).toEqual([{ slideId: "a", seconds: 12 }]);
  });
  it("caps seconds and entry count", () => {
    expect(normalizeSlideTimings([{ slideId: "a", seconds: 99_999 }], slides)).toEqual([
      { slideId: "a", seconds: 10_800 },
    ]);
    const many = Array.from({ length: 60 }, () => ({ slideId: "a", seconds: 1 }));
    expect(normalizeSlideTimings(many, slides).length).toBeLessThanOrEqual(40);
    expect(normalizeSlideTimings("x", slides)).toEqual([]);
  });
});

describe("normalizeTakeInput", () => {
  const good = {
    talkTitle: "Q3 review", durationSec: 305.7, transcript: "hello", feedback: "**Overall** ok",
    effective: { score: 70 }, nonverbal: null, slideTimings: [{ slideId: "a", seconds: 3 }],
  };
  it("normalizes a valid take", () => {
    const t = normalizeTakeInput(good)!;
    expect(t.durationSec).toBe(306);
    expect(t.talkTitle).toBe("Q3 review");
    expect(t.effective).toEqual({ score: 70 });
    expect(t.slideTimings).toEqual([{ slideId: "a", seconds: 3 }]);
  });
  it("rejects a take without transcript or feedback", () => {
    expect(normalizeTakeInput({ ...good, transcript: "  " })).toBeNull();
    expect(normalizeTakeInput({ ...good, feedback: "" })).toBeNull();
    expect(normalizeTakeInput(null)).toBeNull();
  });
  it("clamps and truncates", () => {
    const t = normalizeTakeInput({ ...good, durationSec: 1e9, transcript: "x".repeat(20_000), feedback: "y".repeat(50_000), talkTitle: "t".repeat(500) })!;
    expect(t.durationSec).toBe(10_800);
    expect(t.transcript).toHaveLength(12_000);
    expect(t.feedback).toHaveLength(40_000);
    expect(t.talkTitle).toHaveLength(120);
  });
});

describe("accumulateTimings", () => {
  it("gives the whole take to the slide showing when recording started", () => {
    expect(accumulateTimings([{ slideId: "a", at: 0 }], 1_000, 61_000)).toEqual([
      { slideId: "a", seconds: 60 },
    ]);
  });
  it("ignores slide changes before recording started", () => {
    const changes = [
      { slideId: "a", at: 0 },
      { slideId: "b", at: 500 },
      { slideId: "c", at: 900 },
    ];
    expect(accumulateTimings(changes, 1_000, 11_000)).toEqual([{ slideId: "c", seconds: 10 }]);
  });
  it("adds up revisits and rapid back-and-forth", () => {
    const changes = [
      { slideId: "a", at: 0 },
      { slideId: "b", at: 10_000 },
      { slideId: "a", at: 15_000 },
      { slideId: "b", at: 15_200 },
    ];
    expect(accumulateTimings(changes, 0, 20_000)).toEqual([
      { slideId: "a", seconds: 10 },
      { slideId: "b", seconds: 10 },
    ]);
  });
  it("ignores changes after recording stopped", () => {
    const changes = [{ slideId: "a", at: 0 }, { slideId: "b", at: 30_000 }];
    expect(accumulateTimings(changes, 0, 20_000)).toEqual([{ slideId: "a", seconds: 20 }]);
  });
  it("returns [] with no changes", () => {
    expect(accumulateTimings([], 0, 1_000)).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(160)).toBe("2:40");
    expect(formatDuration(3_725)).toBe("62:05");
  });
});
```

Create `lib/rubric.presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRESENTATION_RUBRIC } from "./rubric";
import { RUBRIC_ATTRIBUTES, TONES } from "./types";

describe("PRESENTATION_RUBRIC", () => {
  it("is Clear 30 · Confident 25 · Connected 25 · Smooth 20", () => {
    expect(PRESENTATION_RUBRIC.attributes).toEqual(["clear", "confident", "connected", "smooth"]);
    expect(PRESENTATION_RUBRIC.weights).toEqual({ clear: 30, confident: 25, connected: 25, smooth: 20 });
    expect(PRESENTATION_RUBRIC.custom).toBe(false);
  });
  it("uses valid attributes and weights summing to 100", () => {
    for (const a of PRESENTATION_RUBRIC.attributes) expect(RUBRIC_ATTRIBUTES).toContain(a);
    expect(Object.values(PRESENTATION_RUBRIC.weights).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("is not a tone", () => {
    expect(TONES as readonly string[]).not.toContain("presenting");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module './presentationPrep'` and `PRESENTATION_RUBRIC` undefined.

- [ ] **Step 4: Implement `lib/presentationPrep.ts`**

```ts
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
  return [...totals.entries()].map(([slideId, ms]) => ({ slideId, seconds: Math.round(ms / 1000) }));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
```

- [ ] **Step 5: Append `PRESENTATION_RUBRIC` to `lib/rubric.ts`**

```ts
/**
 * Fixed rubric for presentation mode (app/prep/presentation). Deliberately NOT
 * a Tone — adding one would change the /script and /generate tone dropdowns.
 * Leans on pace, fillers, voice steadiness and (with camera) eye contact.
 */
export const PRESENTATION_RUBRIC: RubricSelection = {
  attributes: ["clear", "confident", "connected", "smooth"],
  weights: { clear: 30, confident: 25, connected: 25, smooth: 20 },
  custom: false,
};
```

(`RubricSelection` is already in `lib/rubric.ts`'s type import from `./types`.)

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS (all suites). Then `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/rubric.ts lib/presentationPrep.ts lib/presentationPrep.test.ts lib/rubric.presentation.test.ts
git commit -m "Add presentation types, pure normalization, slide timings, and rubric

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `.pptx` import

**Files:**
- Modify: `package.json` (add `fflate`)
- Create: `lib/pptxImport.ts`, `lib/pptxImport.test.ts`

**Interfaces:**
- Consumes: `capSlides` (Task 1), `PresentationSlide` type.
- Produces: `decodeXmlEntities(s: string): string`, `slideOrder(presentationXml: string, relsXml: string): string[]` (zip paths like `ppt/slides/slide1.xml`), `resolveTarget(fromPath: string, target: string): string`, `notesPathFor(slideRelsXml: string, slidePath: string): string | null`, `slideTitle(slideXml: string): string`, `notesText(notesXml: string): string`, `slidesFromZip(files: Record<string, Uint8Array>): { slides: PresentationSlide[]; truncated: boolean; hadNotes: boolean }`, `extractSlides(file: File): Promise<{ slides: PresentationSlide[]; truncated: boolean; hadNotes: boolean }>` (throws `Error` with a user-facing message).

- [ ] **Step 1: Install fflate**

Run: `npm install fflate@^0.8`
Expected: `fflate` appears in `dependencies` of `package.json`.

- [ ] **Step 2: Write failing tests** — create `lib/pptxImport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  decodeXmlEntities,
  extractSlides,
  notesPathFor,
  notesText,
  resolveTarget,
  slideOrder,
  slideTitle,
  slidesFromZip,
} from "./pptxImport";

const sp = (phType: string | null, paras: string[]) =>
  `<p:sp><p:nvSpPr><p:nvPr>${phType ? `<p:ph type="${phType}"/>` : ""}</p:nvPr></p:nvSpPr><p:txBody>${paras
    .map((t) => `<a:p><a:pPr/><a:r><a:rPr lang="en-US"/><a:t>${t}</a:t></a:r></a:p>`)
    .join("")}<a:p/></p:txBody></p:sp>`;
const slideXml = (title: string, body = "Bullet") =>
  `<p:sld><p:cSld><p:spTree>${sp("title", [title])}${sp(null, [body])}</p:spTree></p:cSld></p:sld>`;
const notesXml = (paras: string[]) =>
  `<p:notes><p:cSld><p:spTree>${sp("sldImg", [])}${sp("body", paras)}${sp("sldNum", ["7"])}</p:spTree></p:cSld></p:notes>`;

const PRES = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`;
const PRES_RELS = `<Relationships><Relationship Id="rId2" Type="http://x/slide" Target="slides/slide10.xml"/><Relationship Target="slides/slide2.xml" Id="rId3" Type="http://x/slide"/><Relationship Id="rId1" Type="http://x/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`;

describe("decodeXmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeXmlEntities("R&amp;D &lt;b&gt; &quot;q&quot; it&apos;s &#8217; &#x2014;")).toBe(
      "R&D <b> \"q\" it's ’ —",
    );
  });
});

describe("slideOrder", () => {
  it("follows sldIdLst, not file names", () => {
    expect(slideOrder(PRES, PRES_RELS)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide10.xml"]);
  });
  it("handles absolute targets", () => {
    const rels = `<Relationships><Relationship Id="rId3" Target="/ppt/slides/slide2.xml"/><Relationship Id="rId2" Target="/ppt/slides/slide1.xml"/></Relationships>`;
    expect(slideOrder(PRES, rels)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  });
});

describe("resolveTarget / notesPathFor", () => {
  it("resolves ../ relative to the source part's folder", () => {
    expect(resolveTarget("ppt/slides/slide1.xml", "../notesSlides/notesSlide1.xml")).toBe(
      "ppt/notesSlides/notesSlide1.xml",
    );
  });
  it("finds the notesSlide relationship", () => {
    const rels = `<Relationships><Relationship Id="rId1" Type="http://x/slideLayout" Target="../slideLayouts/slideLayout2.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide3.xml"/></Relationships>`;
    expect(notesPathFor(rels, "ppt/slides/slide3.xml")).toBe("ppt/notesSlides/notesSlide3.xml");
    expect(notesPathFor("<Relationships/>", "ppt/slides/slide3.xml")).toBeNull();
  });
});

describe("slideTitle / notesText", () => {
  it("reads the title placeholder only", () => {
    expect(slideTitle(slideXml("Pricing &amp; tiers", "Not the title"))).toBe("Pricing & tiers");
    expect(slideTitle(`<p:sld>${sp("ctrTitle", ["Welcome"])}</p:sld>`)).toBe("Welcome");
    expect(slideTitle(`<p:sld>${sp(null, ["no title"])}</p:sld>`)).toBe("");
  });
  it("reads the notes body, one line per paragraph, without the slide number", () => {
    expect(notesText(notesXml(["Three tiers", "Anchor on Pro"]))).toBe("Three tiers\nAnchor on Pro");
  });
  it("returns an empty string when there are no notes", () => {
    expect(notesText(notesXml([]))).toBe("");
  });
});

function buildPptx(slides: { title: string; notes: string[] | null }[]): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join("");
  files["ppt/presentation.xml"] = strToU8(`<p:presentation><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`);
  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 10}" Type="http://x/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  slides.forEach((s, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(slideXml(s.title));
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(
      s.notes
        ? `<Relationships><Relationship Id="rId2" Type="http://x/relationships/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/></Relationships>`
        : "<Relationships/>",
    );
    if (s.notes) files[`ppt/notesSlides/notesSlide${i + 1}.xml`] = strToU8(notesXml(s.notes));
  });
  return files;
}

describe("slidesFromZip", () => {
  it("builds slides with titles and notes in presentation order", () => {
    const r = slidesFromZip(buildPptx([{ title: "Intro", notes: ["Hook"] }, { title: "Pricing", notes: null }]));
    expect(r.slides.map((s) => [s.title, s.notes])).toEqual([["Intro", "Hook"], ["Pricing", ""]]);
    expect(r.hadNotes).toBe(true);
    expect(r.truncated).toBe(false);
    expect(new Set(r.slides.map((s) => s.id)).size).toBe(2);
  });
  it("flags a deck with no notes", () => {
    expect(slidesFromZip(buildPptx([{ title: "A", notes: null }])).hadNotes).toBe(false);
  });
  it("trims a 60-slide deck to 40", () => {
    const big = Array.from({ length: 60 }, (_, i) => ({ title: `S${i}`, notes: ["n"] }));
    const r = slidesFromZip(buildPptx(big));
    expect(r.slides).toHaveLength(40);
    expect(r.truncated).toBe(true);
  });
  it("throws a friendly error without presentation.xml", () => {
    expect(() => slidesFromZip({})).toThrow("Couldn't read that PowerPoint file.");
  });
  it("throws when the deck has no slides", () => {
    expect(() => slidesFromZip(buildPptx([]))).toThrow("That deck has no slides.");
  });
});

describe("extractSlides", () => {
  it("reads a real in-memory .pptx file", async () => {
    const bytes = zipSync(buildPptx([{ title: "Hello", notes: ["World"] }]));
    const file = new File([bytes], "deck.pptx");
    const r = await extractSlides(file);
    expect(r.slides[0]).toMatchObject({ title: "Hello", notes: "World" });
  });
  it("rejects legacy .ppt and non-zip files", async () => {
    await expect(extractSlides(new File(["x"], "old.ppt"))).rejects.toThrow("Save it as .pptx and try again.");
    await expect(extractSlides(new File(["not a zip"], "deck.pptx"))).rejects.toThrow("Couldn't read that PowerPoint file.");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/pptxImport.test.ts`
Expected: FAIL — `Cannot find module './pptxImport'`.

- [ ] **Step 4: Implement `lib/pptxImport.ts`**

```ts
import { strFromU8, unzipSync } from "fflate";
import { capSlides } from "./presentationPrep";
import type { PresentationSlide } from "./types";

// .pptx → slides (title + speaker notes), entirely in the browser. A .pptx is
// a zip of XML parts; slide order comes from ppt/presentation.xml's sldIdLst
// (NOT file names — slide10.xml can come before slide2.xml). The XML helpers
// are plain string functions so they're unit-testable in Node without a DOM.
// Dynamically imported by SlideListEditor only when a .pptx is picked.

const MAX_PPTX_BYTES = 50 * 1024 * 1024;

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function relationships(relsXml: string): { id: string; type: string; target: string }[] {
  return [...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => ({
    id: attr(m[0], "Id") ?? "",
    type: attr(m[0], "Type") ?? "",
    target: attr(m[0], "Target") ?? "",
  }));
}

/** Resolve a relationship target relative to the folder of `fromPath`. */
export function resolveTarget(fromPath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

export function slideOrder(presentationXml: string, relsXml: string): string[] {
  const byId = new Map(relationships(relsXml).map((r) => [r.id, r.target]));
  return [...presentationXml.matchAll(/<p:sldId\b[^>]*>/g)]
    .map((m) => attr(m[0], "r:id"))
    .map((rid) => (rid ? byId.get(rid) : undefined))
    .filter((t): t is string => Boolean(t))
    .map((t) => resolveTarget("ppt/presentation.xml", t));
}

export function notesPathFor(slideRelsXml: string, slidePath: string): string | null {
  const rel = relationships(slideRelsXml).find((r) => /\/notesSlide$/.test(r.type));
  return rel ? resolveTarget(slidePath, rel.target) : null;
}

function shapes(xml: string): string[] {
  return [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].map((m) => m[0]);
}

function placeholderType(shape: string): string | null {
  const ph = shape.match(/<p:ph\b[^>]*>/);
  if (!ph) return null;
  return attr(ph[0], "type") ?? "body";
}

function paragraphs(shape: string): string[] {
  return [...shape.replace(/<a:p\b[^>]*\/>/g, "").matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
    .map((p) =>
      decodeXmlEntities([...p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join("")).trim(),
    )
    .filter(Boolean);
}

export function slideTitle(slideXml: string): string {
  const title = shapes(slideXml).find((s) => /^(title|ctrTitle)$/.test(placeholderType(s) ?? ""));
  return title ? paragraphs(title).join(" ") : "";
}

const NON_NOTE_PLACEHOLDERS = new Set(["sldNum", "sldImg", "hdr", "ftr", "dt"]);

export function notesText(notesXml: string): string {
  return shapes(notesXml)
    .filter((s) => !NON_NOTE_PLACEHOLDERS.has(placeholderType(s) ?? ""))
    .flatMap(paragraphs)
    .join("\n");
}

function newSlideId(i: number): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `slide-${i + 1}-${rand}`;
}

export function slidesFromZip(files: Record<string, Uint8Array>): {
  slides: PresentationSlide[];
  truncated: boolean;
  hadNotes: boolean;
} {
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : null);
  const pres = read("ppt/presentation.xml");
  const presRels = read("ppt/_rels/presentation.xml.rels");
  if (!pres || !presRels) throw new Error("Couldn't read that PowerPoint file.");

  const paths = slideOrder(pres, presRels);
  if (!paths.length) throw new Error("That deck has no slides.");

  const slides = paths.map((path, i) => {
    const xml = read(path) ?? "";
    const relsPath = path.replace(/([^/]+)$/, "_rels/$1.rels");
    const rels = read(relsPath);
    const notesPath = rels ? notesPathFor(rels, path) : null;
    const notesXml = notesPath ? read(notesPath) : null;
    return { id: newSlideId(i), title: slideTitle(xml), notes: notesXml ? notesText(notesXml) : "" };
  });

  const hadNotes = slides.some((s) => s.notes.trim());
  const capped = capSlides(
    slides.map((s) => ({ ...s, title: s.title.slice(0, 200), notes: s.notes.slice(0, 2000) })),
  );
  const perSlideCut = slides.some((s) => s.title.length > 200 || s.notes.length > 2000);
  return { slides: capped.slides, truncated: capped.truncated || perSlideCut, hadNotes };
}

/** Throws Error with a user-facing message on anything unreadable. */
export async function extractSlides(file: File): Promise<{
  slides: PresentationSlide[];
  truncated: boolean;
  hadNotes: boolean;
}> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ppt")) throw new Error("Save it as .pptx and try again.");
  if (file.size > MAX_PPTX_BYTES) throw new Error("That file is over the 50 MB limit.");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // Only the XML parts we need — skips media, which can be huge.
      filter: (f) => f.name.startsWith("ppt/") && f.name.endsWith(".xml") || f.name.endsWith(".rels"),
    });
  } catch {
    throw new Error("Couldn't read that PowerPoint file.");
  }
  return slidesFromZip(files);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/pptxImport.ts lib/pptxImport.test.ts
git commit -m "Add in-browser .pptx import (slide titles + speaker notes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Persistence — tables, server module, routes, client store

**Files:**
- Modify: `prisma/schema.prisma`
- Generated: `prisma/migrations/<ts>_presentation_mode/migration.sql`
- Create: `lib/presentationPrep.server.ts`, `app/api/presentation-prep/route.ts`, `app/api/presentation-takes/route.ts`, `app/api/presentation-takes/[id]/route.ts`, `lib/presentationStore.ts`

**Interfaces:**
- Consumes: `normalizePresentationPrep`, `normalizeTakeInput` (Task 1); `ensureSession`, `getSessionId`; `logError`, `newRequestId`.
- Produces:
  - server: `getPresentationPrep(sessionId): Promise<PresentationPrep>`, `savePresentationPrep(sessionId, input: unknown): Promise<PresentationPrep>`, `listTakes(sessionId): Promise<PresentationTake[]>`, `addTake(sessionId, input: unknown): Promise<PresentationTake>` (throws `Error("invalid take")`), `removeTake(sessionId, id): Promise<void>`
  - routes: `GET/PUT /api/presentation-prep`, `GET/POST /api/presentation-takes`, `DELETE /api/presentation-takes/[id]`
  - client: `loadPresentationPrep(): Promise<PresentationPrep>`, `savePresentationPrep(prep, opts?: { keepalive?: boolean }): Promise<void>`, `loadTakes(): Promise<PresentationTake[]>`, `saveTake(input: PresentationTakeInput): Promise<PresentationTake>`, `deleteTake(id: string): Promise<void>`

No unit tests (DB-bound; normalization is tested in Task 1). Verified with curl.

- [ ] **Step 1: Schema** — in `model Session` add after `interviewPrep InterviewPrep?`:

```prisma
  presentationPrep  PresentationPrep?
  presentationTakes PresentationTake[]
```

Append:

```prisma
/// Presentation-mode setup for /prep/presentation. One per session.
model PresentationPrep {
  id        String   @id @default(cuid())
  sessionId String   @unique
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  /// PresentationPrep (lib/types.ts).
  prep      Json
}

/// One presentation run-through + its feedback. Newest 50 per session kept.
/// Deliberately separate from Attempt so /practice history never shows these.
model PresentationTake {
  id           String   @id @default(cuid())
  sessionId    String
  session      Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  talkTitle    String   @default("")
  durationSec  Int      @default(0)
  transcript   String
  feedback     String
  effective    Json?
  nonverbal    Json?
  slideTimings Json?

  @@index([sessionId, createdAt])
}
```

- [ ] **Step 2: Migrate** (creates two new tables in the dev DB from `.env`; touches no existing data)

Run: `npm run db:migrate -- --name presentation_mode`
Expected: migration created + applied, `Generated Prisma Client`. If it fails with `P1001` (Neon cold start), re-run once.

- [ ] **Step 3: Create `lib/presentationPrep.server.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureSession } from "./session";
import { normalizePresentationPrep, normalizeTakeInput } from "./presentationPrep";
import type { PresentationPrep, PresentationTake } from "./types";

// Server data layer for presentation mode. Everything is normalized
// (lib/presentationPrep.ts) on the way in; takes are session-scoped.

const MAX_TAKES = 50;

type TakeRow = Prisma.PresentationTakeGetPayload<object>;

function rowToTake(r: TakeRow): PresentationTake {
  return {
    id: r.id,
    createdAt: r.createdAt.getTime(),
    talkTitle: r.talkTitle,
    durationSec: r.durationSec,
    transcript: r.transcript,
    feedback: r.feedback,
    effective: (r.effective ?? null) as PresentationTake["effective"],
    nonverbal: (r.nonverbal ?? null) as PresentationTake["nonverbal"],
    slideTimings: (r.slideTimings ?? null) as PresentationTake["slideTimings"],
  };
}

const json = (v: unknown) =>
  v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);

export async function getPresentationPrep(sessionId: string): Promise<PresentationPrep> {
  const row = await prisma.presentationPrep.findUnique({ where: { sessionId } });
  return normalizePresentationPrep(row?.prep ?? null);
}

export async function savePresentationPrep(
  sessionId: string,
  input: unknown,
): Promise<PresentationPrep> {
  const prep = normalizePresentationPrep(input);
  await ensureSession(sessionId);
  const data = { prep: prep as unknown as Prisma.InputJsonValue };
  await prisma.presentationPrep.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
  return prep;
}

export async function listTakes(sessionId: string): Promise<PresentationTake[]> {
  const rows = await prisma.presentationTake.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: MAX_TAKES,
  });
  return rows.map(rowToTake);
}

export async function addTake(sessionId: string, input: unknown): Promise<PresentationTake> {
  const take = normalizeTakeInput(input);
  if (!take) throw new Error("invalid take");
  await ensureSession(sessionId);
  const row = await prisma.presentationTake.create({
    data: {
      sessionId,
      talkTitle: take.talkTitle,
      durationSec: take.durationSec,
      transcript: take.transcript,
      feedback: take.feedback,
      effective: json(take.effective),
      nonverbal: json(take.nonverbal),
      slideTimings: json(take.slideTimings),
    },
  });
  const stale = await prisma.presentationTake.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    skip: MAX_TAKES,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.presentationTake.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
  return rowToTake(row);
}

export async function removeTake(sessionId: string, id: string): Promise<void> {
  await prisma.presentationTake.deleteMany({ where: { id, sessionId } });
}
```

- [ ] **Step 4: Create `app/api/presentation-prep/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { getPresentationPrep, savePresentationPrep } from "@/lib/presentationPrep.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-prep";

// The session's presentation setup. User content — never logged or tracked.

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await getPresentationPrep(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't load your saved setup." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const rid = newRequestId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    return NextResponse.json(await savePresentationPrep(getSessionId(), body));
  } catch (err) {
    logError(SCOPE, rid, `PUT failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't save your setup." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/presentation-takes/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { addTake, listTakes } from "@/lib/presentationPrep.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-takes";

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await listTakes(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't load your past runs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rid = newRequestId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    return NextResponse.json(await addTake(getSessionId(), body));
  } catch (err) {
    if (err instanceof Error && err.message === "invalid take") {
      return NextResponse.json({ error: "A run needs a transcript and feedback." }, { status: 400 });
    }
    logError(SCOPE, rid, `POST failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't save this run." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `app/api/presentation-takes/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { removeTake } from "@/lib/presentationPrep.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-takes";

// DELETE one take — session-scoped, so a foreign id is a silent no-op.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const rid = newRequestId();
  try {
    await removeTake(getSessionId(), params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(SCOPE, rid, `DELETE failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't delete that run." }, { status: 500 });
  }
}
```

- [ ] **Step 7: Create `lib/presentationStore.ts`**

```ts
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
```

- [ ] **Step 8: Verify with curl** (dev server running; `SITE_PASSWORD` is set, so first obtain the gate cookie by POSTing `{"password": …}` read from `.env.local` to `/api/gate` into a cookie jar in the session scratchpad — never print the password)

```bash
curl -s -b $JAR http://localhost:3000/api/presentation-prep
# Expected: {"title":"","mode":"notes","notes":"","slides":[],"audience":"","timeLimitMin":null}
curl -s -b $JAR -X PUT -H 'Content-Type: application/json' -d '{"title":"Q3","mode":"slides","slides":[{"id":"a","title":"Intro"}],"timeLimitMin":500}' http://localhost:3000/api/presentation-prep
# Expected: mode "slides", slides[0].title "Intro", timeLimitMin null
curl -s -b $JAR -X POST -H 'Content-Type: application/json' -d '{"talkTitle":"Q3","durationSec":61,"transcript":"hi","feedback":"**Overall** ok"}' http://localhost:3000/api/presentation-takes
# Expected: a take with an id + numeric createdAt
curl -s -b $JAR http://localhost:3000/api/presentation-takes          # Expected: [that take]
curl -s -b $JAR -X DELETE http://localhost:3000/api/presentation-takes/<id>   # Expected: {"ok":true}
curl -s -b $JAR -X POST -H 'Content-Type: application/json' -d '{"transcript":""}' -w " %{http_code}" http://localhost:3000/api/presentation-takes
# Expected: 400
curl -s -b $JAR -X PUT -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/presentation-prep
# (reset the test setup to defaults)
```

Run: `npx tsc --noEmit && npm test` → clean / PASS.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/presentationPrep.server.ts lib/presentationStore.ts app/api/presentation-prep app/api/presentation-takes
git commit -m "Persist presentation setup and take history per session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Feedback — prompt, verifier, Claude call, route

**Files:**
- Modify: `lib/prompt.ts`, `lib/verifyOutput.ts`, `lib/anthropic.ts` (all append + imports)
- Create: `lib/prompt.presentation.test.ts`, `lib/verifyOutput.presentation.test.ts`, `app/api/presentation-feedback/route.ts`

**Interfaces:**
- Consumes: `normalizePresentationPrep`, `normalizeSlideTimings`, `presentationHasContent`, `formatDuration`, `PRESENTATION_LIMITS` (Task 1); `PRESENTATION_RUBRIC`, `coerceSignals`, `computeEffective`, `formatRubricForPrompt` (`lib/rubric.ts`); `coerceNonverbal`, `formatNonverbalForPrompt` (`lib/nonverbal.ts`); `SECTION_HEAD` (existing, `lib/verifyOutput.ts`); `demoLimitResponse`, `anthropicErrorResponse` (`lib/claudeRoute.ts`).
- Produces:
  - `lib/prompt.ts`: `PRESENTATION_FEEDBACK_SYSTEM_PROMPT`, `buildPresentationFeedbackPrompt(input: { prep: PresentationPrep; transcript: string; durationSec: number; slideTimings: SlideTiming[]; nonverbal: NonverbalMetrics | null; effective: EffectiveResult | null; signals: ObservableSignals | null }): string`
  - `lib/verifyOutput.ts`: `verifyPresentationFeedback(text: unknown): FeedbackCheck`
  - `lib/anthropic.ts`: `generatePresentationFeedback(input: same as the builder): Promise<string>`
  - `POST /api/presentation-feedback` → `{ feedback }`

- [ ] **Step 1: Write failing tests**

Create `lib/prompt.presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPresentationFeedbackPrompt } from "./prompt";
import { emptyPresentationPrep } from "./presentationPrep";
import type { PresentationPrep } from "./types";

const slidesPrep: PresentationPrep = {
  ...emptyPresentationPrep(),
  title: "Q3 review",
  mode: "slides",
  notes: "IGNORED NOTES",
  slides: [
    { id: "a", title: "Intro", notes: "Hook with the churn number" },
    { id: "b", title: "Pricing", notes: "" },
  ],
  audience: "Exec team; CFO cares about cost",
  timeLimitMin: 10,
};

const base = { transcript: "So today...", durationSec: 305, nonverbal: null, effective: null, signals: null };

describe("buildPresentationFeedbackPrompt", () => {
  it("tags slides S1..Sn with titles and notes, and marks empty notes", () => {
    const t = buildPresentationFeedbackPrompt({ ...base, prep: slidesPrep, slideTimings: [] });
    expect(t).toContain('<talk title="Q3 review">');
    expect(t).toContain('<slide tag="S1">\nTitle: Intro\n<notes>\nHook with the churn number\n</notes>\n</slide>');
    expect(t).toContain('<slide tag="S2">\nTitle: Pricing\n(no notes)\n</slide>');
    expect(t).not.toContain("IGNORED NOTES");
  });

  it("uses the notes block in notes mode", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: { ...slidesPrep, mode: "notes", notes: "Point one\nPoint two" },
      slideTimings: [],
    });
    expect(t).toContain("<notes>\nPoint one\nPoint two\n</notes>");
    expect(t).not.toContain("<slide ");
  });

  it("includes audience, time limit, timings and total duration", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: slidesPrep,
      slideTimings: [{ slideId: "b", seconds: 160 }, { slideId: "a", seconds: 45 }],
    });
    expect(t).toContain("<audience>\nExec team; CFO cares about cost\n</audience>");
    expect(t).toContain('<time_limit minutes="10" />');
    expect(t).toContain("S1 Intro: 0:45");
    expect(t).toContain("S2 Pricing: 2:40");
    expect(t).toContain("Total: 5:05");
    expect(t.indexOf("S1 Intro: 0:45")).toBeLessThan(t.indexOf("S2 Pricing: 2:40"));
  });

  it("omits optional blocks when absent", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: { ...slidesPrep, audience: "", timeLimitMin: null },
      slideTimings: [],
    });
    expect(t).not.toContain("<audience>");
    expect(t).not.toContain("<time_limit");
    expect(t).not.toContain("<slide_timings>");
    expect(t).not.toContain("<camera>");
    expect(t).not.toContain("EFFECTIVENESS RUBRIC");
    expect(t).toContain("Total: 5:05");
  });

  it("labels the transcript as speech-to-text", () => {
    const t = buildPresentationFeedbackPrompt({ ...base, prep: slidesPrep, slideTimings: [] });
    expect(t).toMatch(/<transcript>\n\(Spoken out loud and transcribed by speech-to-text[^\n]*\)\nSo today\.\.\.\n<\/transcript>/);
  });
});
```

Create `lib/verifyOutput.presentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { verifyPresentationFeedback } from "./verifyOutput";

const FULL = [
  "**Overall** — Effective 72, Solid.",
  "**Coverage**",
  "- S1 Intro — covered: strong hook.",
  "**Flow & timing** — Ran 5:05 of 10.",
  "**Delivery** — Pace was quick.",
  "**For your next run**",
  "- Slow down on pricing.",
].join("\n");

describe("verifyPresentationFeedback", () => {
  it("accepts all required sections without Nonverbal", () => {
    expect(verifyPresentationFeedback(FULL).ok).toBe(true);
  });
  it("accepts 'Flow and timing' and ## headings", () => {
    const t = FULL.replace("**Flow & timing**", "## Flow and timing");
    expect(verifyPresentationFeedback(t).ok).toBe(true);
  });
  it("reports each missing section", () => {
    const r = verifyPresentationFeedback(FULL.replace("**Coverage**", "").replace("**Delivery** — Pace was quick.", ""));
    expect(r).toMatchObject({ ok: false, missing: ["Coverage", "Delivery"] });
  });
  it("does not let a ### subheading satisfy a section", () => {
    const t = FULL.replace("**For your next run**", "### Next run of the pilot?");
    expect(verifyPresentationFeedback(t)).toMatchObject({ ok: false, missing: ["For your next run"] });
  });
  it("rejects empty output", () => {
    expect(verifyPresentationFeedback("")).toMatchObject({ ok: false, reason: "empty-or-too-short" });
    expect(verifyPresentationFeedback(null).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `buildPresentationFeedbackPrompt` / `verifyPresentationFeedback` not exported.

- [ ] **Step 3: Append to `lib/prompt.ts`**

Add to the `./types` type import: `PresentationPrep, SlideTiming` (keep existing names). Add imports:

```ts
import { formatDuration } from "./presentationPrep";
```

(`formatNonverbalForPrompt` and `formatRubricForPrompt` are already imported at the top of `lib/prompt.ts`.) Append:

```ts
// --- Presentation mode (app/prep/presentation) -------------------------------

export const PRESENTATION_FEEDBACK_SYSTEM_PROMPT = `You are a presentation coach reviewing one rehearsal run-through of a talk. The speaker had speaker notes or slides (given below) — NOT a word-for-word script — and delivered the whole talk out loud in one take. It was captured by speech-to-text; ignore transcription noise and never comment on it.

Judge two things: whether they got their material across (coverage, order, timing), and how they delivered it. Paraphrasing the notes is fine and expected — "covered" means the point landed, not that the wording matched.

Format the response in Markdown with these sections, in this order, using exactly these bold headings:
- **Overall** — two or three sentences on how the run went. State the Effective score if one is given.
- **Coverage** — if slides are given (tagged S1, S2, …): one bullet per slide, "S<n> <title> — covered | partly | missed: <one short reason>". If only notes are given: identify up to 8 main talking points from the notes and give one bullet each with the same verdicts. Quote a few words from the transcript where it helps.
- **Flow & timing** — 2 to 3 bullets: order and transitions, time per slide when timings are given (call out slides that ran long or got rushed), and total length against the time limit when one is given.
- **Delivery** — 2 to 3 bullets on pace, filler words, and energy; name the highest-weighted quality that scored lowest when a rubric is given.
- **Nonverbal** — ONLY if a <camera> block is present: 1 to 2 bullets. Omit this section entirely otherwise.
- **For your next run** — 2 to 3 concrete, prioritized changes.

When a rubric block refers to "For your next take", apply that to **For your next run**. If an <audience> is described, say what that audience will care about where it matters ("the CFO will want the cost figure before slide 5"). Be direct but supportive. No preamble before the feedback.`;

export function buildPresentationFeedbackPrompt(input: {
  prep: PresentationPrep;
  transcript: string;
  durationSec: number;
  slideTimings: SlideTiming[];
  nonverbal: NonverbalMetrics | null;
  effective: EffectiveResult | null;
  signals: ObservableSignals | null;
}): string {
  const { prep } = input;
  const titleAttr = prep.title.trim().replace(/"/g, "'");
  const lines: string[] = [`<talk title="${titleAttr}">`];
  if (prep.mode === "slides") {
    prep.slides.forEach((s, i) => {
      lines.push(`<slide tag="S${i + 1}">`, `Title: ${s.title.trim() || "(untitled)"}`);
      if (s.notes.trim()) lines.push("<notes>", s.notes.trim(), "</notes>");
      else lines.push("(no notes)");
      lines.push("</slide>");
    });
  } else {
    lines.push("<notes>", prep.notes.trim(), "</notes>");
  }
  lines.push("</talk>");

  if (prep.audience.trim()) lines.push("", "<audience>", prep.audience.trim(), "</audience>");
  if (prep.timeLimitMin) lines.push("", `<time_limit minutes="${prep.timeLimitMin}" />`);

  lines.push("", "<slide_timings_summary>", `Total: ${formatDuration(input.durationSec)}`, "</slide_timings_summary>");
  if (prep.mode === "slides" && input.slideTimings.length) {
    const byId = new Map(input.slideTimings.map((t) => [t.slideId, t.seconds]));
    const rows = prep.slides
      .map((s, i) =>
        byId.has(s.id)
          ? `S${i + 1} ${s.title.trim() || "(untitled)"}: ${formatDuration(byId.get(s.id) as number)}`
          : null,
      )
      .filter(Boolean);
    if (rows.length) lines.push("", "<slide_timings>", ...(rows as string[]), "</slide_timings>");
  }

  if (input.effective && input.signals) {
    lines.push("", formatRubricForPrompt(input.effective, input.signals));
  }
  if (input.nonverbal) {
    lines.push("", "<camera>", formatNonverbalForPrompt(input.nonverbal), "</camera>");
  }

  lines.push(
    "",
    "<transcript>",
    "(Spoken out loud and transcribed by speech-to-text — expect some transcription noise.)",
    input.transcript.trim(),
    "</transcript>",
    "",
    "Give the feedback.",
  );
  return lines.join("\n");
}
```

Note: the test for "Total: 5:05" asserts the total line exists; it lives in `<slide_timings_summary>` so it's present even in notes mode or without per-slide timings, while `<slide_timings>` (per slide) is omitted when there are none.

Check the top of `lib/prompt.ts`: it imports `formatNonverbalForPrompt` from `./nonverbal` and `formatRubricForPrompt` from `./rubric` already — reuse them; do not duplicate the imports.

- [ ] **Step 4: Append to `lib/verifyOutput.ts`**

```ts
const PRESENTATION_FEEDBACK_SECTIONS: { label: string; re: RegExp }[] = [
  ["Overall", String.raw`overall\b`],
  ["Coverage", String.raw`coverage\b`],
  ["Flow & timing", String.raw`flow\s*(?:&|and)\s*timing\b`],
  ["Delivery", String.raw`delivery\b`],
  ["For your next run", String.raw`(?:for\s+your\s+)?next\s+run\b`],
].map(([label, body]) => ({ label, re: new RegExp(SECTION_HEAD + body, "i") }));

/** Required presentation-feedback sections (Nonverbal is optional — camera
 *  only). Section headings only: bold or #/## (see SECTION_HEAD). */
export function verifyPresentationFeedback(text: unknown): FeedbackCheck {
  if (typeof text !== "string" || text.trim().length < 60) {
    return {
      ok: false,
      missing: PRESENTATION_FEEDBACK_SECTIONS.map((s) => s.label),
      reason: "empty-or-too-short",
    };
  }
  const missing = PRESENTATION_FEEDBACK_SECTIONS.filter((s) => !s.re.test(text)).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Append to `lib/anthropic.ts`**

Add `PRESENTATION_FEEDBACK_SYSTEM_PROMPT, buildPresentationFeedbackPrompt,` to the `./prompt` import. Append before `function textOf(`:

```ts
export async function generatePresentationFeedback(
  input: Parameters<typeof buildPresentationFeedbackPrompt>[0],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: PRESENTATION_FEEDBACK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildPresentationFeedbackPrompt(input) }],
  });
  return textOf(response);
}
```

- [ ] **Step 7: Create `app/api/presentation-feedback/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generatePresentationFeedback } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { coerceNonverbal } from "@/lib/nonverbal";
import {
  PRESENTATION_LIMITS,
  normalizePresentationPrep,
  normalizeSlideTimings,
  presentationHasContent,
} from "@/lib/presentationPrep";
import { PRESENTATION_RUBRIC, coerceSignals, computeEffective } from "@/lib/rubric";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyPresentationFeedback } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-feedback";

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = (payload ?? {}) as {
    prep?: unknown;
    transcript?: unknown;
    durationSec?: unknown;
    slideTimings?: unknown;
    nonverbal?: unknown;
    signals?: unknown;
  };

  const prep = normalizePresentationPrep(body.prep);
  if (!presentationHasContent(prep)) {
    return NextResponse.json(
      { error: "Add your notes or slides before asking for feedback." },
      { status: 400 },
    );
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your run-through before asking for feedback." },
      { status: 400 },
    );
  }
  if (transcript.length > PRESENTATION_LIMITS.transcript) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }
  const durationSec =
    typeof body.durationSec === "number" && Number.isFinite(body.durationSec)
      ? Math.min(Math.max(Math.round(body.durationSec), 0), PRESENTATION_LIMITS.durationSecMax)
      : 0;
  const slideTimings =
    prep.mode === "slides" ? normalizeSlideTimings(body.slideTimings, prep.slides) : [];
  const nonverbal = coerceNonverbal(body.nonverbal);
  const signals = coerceSignals(body.signals);
  // Recomputed server-side (as practice-feedback does) so the number Claude
  // narrates matches the one the client showed.
  const effective = signals ? computeEffective(PRESENTATION_RUBRIC, signals) : null;

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", {
      mode: prep.mode,
      slides: prep.slides.length,
      transcriptChars: transcript.length,
      hasCamera: nonverbal != null,
    });
    const feedback = await generatePresentationFeedback({
      prep,
      transcript,
      durationSec,
      slideTimings,
      nonverbal,
      effective,
      signals,
    });
    logInfo(SCOPE, rid, "anthropic call succeeded", { chars: feedback.length });

    const check = verifyPresentationFeedback(feedback);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: missing ${check.missing.join(", ")}`);
      Sentry.captureMessage("presentation-feedback verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "missing-sections" },
        extra: { missing: check.missing },
      });
      return NextResponse.json(
        { error: "The feedback came back incomplete. Please try again.", code: "feedback_incomplete" },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ feedback });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm test` → clean / PASS.

With the dev server + gate cookie jar:
```bash
# 400 for an all-blank slides deck (Review Focus #4)
curl -s -b $JAR -X POST -H 'Content-Type: application/json' -d '{"prep":{"mode":"slides","slides":[{"id":"a","title":" "}]},"transcript":"hi"}' -w " %{http_code}\n" http://localhost:3000/api/presentation-feedback
# Expected: {"error":"Add your notes or slides before asking for feedback."} 400
```
Live call (one Claude request) — write the body to a file in the scratchpad and POST it with `--data-binary @file` (never inline JSON with braces+commas in bash, which brace-expands):
body = `{ prep: { title: "Q3 review", mode: "slides", slides: [{id:"a",title:"Intro",notes:"Hook with churn: down 12%"},{id:"b",title:"Pricing",notes:"Three tiers. Anchor on Pro."},{id:"c",title:"Ask",notes:"Approve the Q4 pilot"}], audience: "Exec team; CFO cares about cost", timeLimitMin: 5 }, transcript: "Hi all. Churn is down twelve percent this quarter. We have three pricing tiers. So, um, yeah, that's it.", durationSec: 95, slideTimings: [{slideId:"a",seconds:40},{slideId:"b",seconds:50},{slideId:"c",seconds:5}], signals: { fluency: 70, pace: 60, volume: 65, steadiness: 60, eyeContact: null, posture: null, stillness: null, expressiveness: null, composure: null } }`
Expected: 200 with feedback containing Overall / Coverage (S3 Ask marked missed) / Flow & timing / Delivery / For your next run, no Nonverbal section.

- [ ] **Step 9: Commit**

```bash
git add lib/prompt.ts lib/verifyOutput.ts lib/anthropic.ts lib/prompt.presentation.test.ts lib/verifyOutput.presentation.test.ts app/api/presentation-feedback
git commit -m "Add presentation feedback prompt, verifier, and route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Setup UI — notes, slides editor, `.pptx` import

**Files:**
- Create: `components/PresentationSetup.tsx`, `components/SlideListEditor.tsx`

**Interfaces:**
- Consumes: `PRESENTATION_LIMITS`, `capSlides` (Task 1); `extractSlides` (Task 2, dynamic import); `extractScriptText`, `ACCEPTED_UPLOAD` (`lib/scriptImport.ts`); `newId` (`lib/practiceStore.ts`); `reportClientError`; `components/ui`.
- Produces: `<PresentationSetup value={PresentationPrep} onChange={(next: PresentationPrep) => void} />` (controlled), `<SlideListEditor slides={PresentationSlide[]} onChange={(slides) => void} />`.

UI only — verified in the browser in Task 6.

- [ ] **Step 1: Create `components/SlideListEditor.tsx`**

```tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { reportClientError } from "@/lib/clientErrors";
import { newId } from "@/lib/practiceStore";
import { PRESENTATION_LIMITS } from "@/lib/presentationPrep";
import type { PresentationSlide } from "@/lib/types";
import { Button, Callout, Card, IconButton, Input, Textarea } from "@/components/ui";

// Slides-mode editor: import a .pptx (parsed in the browser — lib/pptxImport
// is dynamically imported so fflate stays out of the main bundle) or add
// slides by hand; every row's title + notes stay editable. Re-importing over
// existing slides asks inline first (no browser dialogs).

interface Props {
  slides: PresentationSlide[];
  onChange: (slides: PresentationSlide[]) => void;
}

export default function SlideListEditor({ slides, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  function pick() {
    if (slides.length && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    fileRef.current?.click();
  }

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { extractSlides } = await import("@/lib/pptxImport");
      const r = await extractSlides(file);
      onChange(r.slides);
      const parts = [`Imported ${r.slides.length} slide${r.slides.length === 1 ? "" : "s"} from “${file.name}”.`];
      if (r.truncated) parts.push("Trimmed to 40 slides / 20,000 characters of notes.");
      if (!r.hadNotes) parts.push("No speaker notes found — add talking points per slide.");
      setNotice(parts.join(" "));
    } catch (err) {
      reportClientError(err, { area: "presentation:pptx-import" });
      setError(err instanceof Error ? err.message : "Couldn't read that PowerPoint file.");
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<PresentationSlide>) =>
    onChange(slides.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon="upload" onClick={pick} disabled={busy}>
          {busy ? "Reading…" : slides.length ? "Re-import .pptx" : "Import .pptx"}
        </Button>
        <input ref={fileRef} type="file" accept=".pptx,.ppt" onChange={handle} className="hidden" />
        <span className="text-caption text-text-muted">
          Reads slide titles + speaker notes in your browser — the file isn&apos;t uploaded.
        </span>
      </div>

      {confirmReplace && (
        <Callout tone="caution">
          <div className="flex flex-wrap items-center gap-3">
            <span>Replace your {slides.length} current slides with the imported deck?</span>
            <Button size="sm" onClick={pick}>Choose file</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>Cancel</Button>
          </div>
        </Callout>
      )}
      {notice && !error && <Callout tone="info">{notice}</Callout>}
      {error && <Callout tone="critical">{error}</Callout>}

      {slides.map((s, i) => (
        <Card key={s.id} tone="sunken" padding="sm" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-caption font-semibold text-text-muted">S{i + 1}</span>
            <Input
              value={s.title}
              maxLength={PRESENTATION_LIMITS.slideTitle}
              onChange={(e) => update(s.id, { title: e.target.value })}
              placeholder="Slide title"
              aria-label={`Slide ${i + 1} title`}
            />
            <IconButton
              icon="trash-2"
              label={`Remove slide ${i + 1}`}
              onClick={() => onChange(slides.filter((x) => x.id !== s.id))}
            />
          </div>
          <Textarea
            value={s.notes}
            rows={3}
            maxLength={PRESENTATION_LIMITS.slideNotes}
            onChange={(e) => update(s.id, { notes: e.target.value })}
            placeholder="(no notes) — add the talking points for this slide"
            aria-label={`Slide ${i + 1} notes`}
          />
        </Card>
      ))}

      {slides.length < PRESENTATION_LIMITS.slidesMax && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...slides, { id: newId(), title: "", notes: "" }])}
        >
          Add slide
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/PresentationSetup.tsx`**

```tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import SlideListEditor from "./SlideListEditor";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import { reportClientError } from "@/lib/clientErrors";
import { PRESENTATION_LIMITS } from "@/lib/presentationPrep";
import type { PresentationPrep } from "@/lib/types";
import { Button, Callout, Card, Field, Input, Tabs, Textarea } from "@/components/ui";

// Controlled setup form for /prep/presentation. Saving is the parent's job.

interface Props {
  value: PresentationPrep;
  onChange: (next: PresentationPrep) => void;
}

export default function PresentationSetup({ value, onChange }: Props) {
  const set = (patch: Partial<PresentationPrep>) => onChange({ ...value, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleNotesFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      set({ notes: text });
      setNote(`Imported “${file.name}”${truncated ? " — trimmed to the first 8,000 characters" : ""}.`);
    } catch (err) {
      reportClientError(err, { area: "presentation:notes-upload" });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <Field label="Talk title" htmlFor="talk-title" hint="Optional — shows up in your run history.">
          <Input
            id="talk-title"
            value={value.title}
            maxLength={PRESENTATION_LIMITS.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Q3 business review"
          />
        </Field>

        <Tabs
          value={value.mode}
          onChange={(v: string) => set({ mode: v === "slides" ? "slides" : "notes" })}
          tabs={[
            { value: "notes", label: "Notes" },
            { value: "slides", label: "Slides" },
          ]}
        />

        {value.mode === "notes" ? (
          <Field
            label="Speaker notes or talking points"
            htmlFor="talk-notes"
            hint="What you plan to cover — bullets are fine. You won't be graded on exact wording."
          >
            <Textarea
              id="talk-notes"
              value={value.notes}
              rows={10}
              maxLength={PRESENTATION_LIMITS.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-caption text-text-muted">or</span>
              <Button variant="secondary" size="sm" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? "Reading…" : "Upload a file"}
              </Button>
              <input ref={fileRef} type="file" accept={ACCEPTED_UPLOAD} onChange={handleNotesFile} className="hidden" />
              <span className="text-caption text-text-muted">.txt, .md, or .pdf</span>
            </div>
            {note && !error && <Callout tone="info">{note}</Callout>}
            {error && <Callout tone="critical">{error}</Callout>}
          </Field>
        ) : (
          <SlideListEditor slides={value.slides} onChange={(slides) => set({ slides })} />
        )}
      </Card>

      <Card tone="sunken" className="space-y-4">
        <Field
          label="Who's in the room?"
          htmlFor="talk-audience"
          hint="Optional — e.g. “exec team; the CFO cares about cost”. Shapes the feedback."
        >
          <Textarea
            id="talk-audience"
            value={value.audience}
            rows={2}
            maxLength={PRESENTATION_LIMITS.audience}
            onChange={(e) => set({ audience: e.target.value })}
          />
        </Field>
        <Field label="Time limit (minutes)" htmlFor="talk-limit" hint="Optional.">
          <Input
            id="talk-limit"
            type="number"
            min={PRESENTATION_LIMITS.timeLimitMinMin}
            max={PRESENTATION_LIMITS.timeLimitMinMax}
            value={value.timeLimitMin ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              set({
                timeLimitMin:
                  e.target.value === "" || !Number.isFinite(n) || n < 1 || n > 120 ? null : Math.round(n),
              });
            }}
            style={{ maxWidth: 120 }}
          />
        </Field>
      </Card>
    </div>
  );
}
```

(`Tabs` props, verified: `{ tabs: (string | { value; label; count? })[]; value?; onChange?(value: string); variant? }`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PresentationSetup.tsx components/SlideListEditor.tsx
git commit -m "Add presentation setup UI with notes and .pptx slide editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Run-through, feedback, history, session, pages

**Files:**
- Create: `components/PresentationRun.tsx`, `components/PresentationFeedbackSections.tsx`, `components/PresentationHistory.tsx`, `components/PresentationSession.tsx`, `app/prep/presentation/page.tsx`
- Modify: `lib/analytics.ts` (`EVENTS`), `app/prep/page.tsx` (Presentation card → link)

**Interfaces:**
- Consumes: Tasks 1–5; `PracticeRecorder`, `speechRecognitionSupported`; `EffectiveScore` (props `{ result, signals?, compact? }`); `NonverbalSummary` (props `{ metrics, compact? }`); `FeedbackWidget`; `postJSON`, `DEMO_LIMIT_MESSAGE`, `FetchError` (`lib/clientFetch.ts`); `shouldPersist` (`lib/interviewRound.ts`); `computeSignals`, `computeEffective`, `PRESENTATION_RUBRIC`; `track`, `EVENTS`.
- Produces: page `/prep/presentation`; `EVENTS.presentationSetupSaved`, `EVENTS.presentationTakeCompleted`, `EVENTS.presentationFeedbackReceived`.

- [ ] **Step 1: Analytics events** — in `lib/analytics.ts` `EVENTS`, after `interviewFeedbackReceived`:

```ts
  presentationSetupSaved: "presentation_setup_saved",
  presentationTakeCompleted: "presentation_take_completed",
  presentationFeedbackReceived: "presentation_feedback_received",
```

- [ ] **Step 2: Create `components/PresentationFeedbackSections.tsx`** — same structure as `components/InterviewFeedbackSections.tsx` (copy that file's `parse`, `renderInline`, `renderBody`, `BOLD_HEADER_RE`, `HASH_HEADER_RE`, `SUBHEAD_RE` and default-export layout verbatim) with this `SECTIONS` table and header comment:

```tsx
// Renderer for presentation feedback (PRESENTATION_FEEDBACK_SYSTEM_PROMPT).
// Standalone copy of InterviewFeedbackSections' approach — different section
// set. Section names are anchored (^) so a subheading can't become a section.
const SECTIONS: { test: RegExp; title: string; icon: string; emphasis?: boolean }[] = [
  { test: /^overall\b/i, title: "Overall", icon: "message-square" },
  { test: /^coverage\b/i, title: "Coverage", icon: "layout-list" },
  { test: /^flow\s*(?:&|and)\s*timing\b/i, title: "Flow & timing", icon: "clock" },
  { test: /^delivery\b/i, title: "Delivery", icon: "mic" },
  { test: /^nonverbal\b/i, title: "Nonverbal", icon: "video" },
  { test: /^(?:for\s+your\s+)?next\s+run\b/i, title: "For your next run", icon: "arrow-right", emphasis: true },
];
```

Name the default export `PresentationFeedbackSections` with props `{ feedback: string }`.

- [ ] **Step 3: Create `components/PresentationRun.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import EffectiveScore from "./EffectiveScore";
import { PRESENTATION_LIMITS, accumulateTimings } from "@/lib/presentationPrep";
import { PRESENTATION_RUBRIC, computeEffective, computeSignals } from "@/lib/rubric";
import type {
  EffectiveResult,
  NonverbalMetrics,
  ObservableSignals,
  PresentationPrep,
  SlideTiming,
} from "@/lib/types";
import { Button, Card, Textarea } from "@/components/ui";

export interface RunResult {
  transcript: string;
  durationSec: number;
  nonverbal: NonverbalMetrics | null;
  signals: ObservableSignals | null;
  effective: EffectiveResult | null;
  slideTimings: SlideTiming[] | null;
}

interface Props {
  prep: PresentationPrep;
  result: RunResult | null;
  onResult: (r: RunResult) => void;
  onTranscript: (t: string) => void;
  onGetFeedback: () => void;
  onBack: () => void;
}

// One continuous take. Slides mode shows the current slide with prev/next;
// every slide change is timestamped, and when a recording stops the time on
// each slide inside the recording window is computed (accumulateTimings).
// Recording again replaces the previous take.
export default function PresentationRun({ prep, result, onResult, onTranscript, onGetFeedback, onBack }: Props) {
  const slides = prep.mode === "slides" ? prep.slides : [];
  const [index, setIndex] = useState(0);
  const changes = useRef<{ slideId: string; at: number }[]>(
    slides.length ? [{ slideId: slides[0].id, at: Date.now() }] : [],
  );
  const speechSupported = speechRecognitionSupported();

  function go(to: number) {
    const next = Math.min(Math.max(to, 0), slides.length - 1);
    if (next === index) return;
    setIndex(next);
    changes.current.push({ slideId: slides[next].id, at: Date.now() });
  }

  const current = slides[index];
  const reference =
    prep.mode === "slides" && current
      ? `${current.title || "(untitled)"}\n\n${current.notes || "(no notes)"}`
      : prep.notes;

  return (
    <div className="space-y-4">
      {prep.mode === "slides" && current && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-text-muted">
              Slide {index + 1} of {slides.length}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => go(index - 1)} disabled={index === 0}>
                Prev
              </Button>
              <Button variant="secondary" size="sm" iconAfter="arrow-right" onClick={() => go(index + 1)} disabled={index === slides.length - 1}>
                Next
              </Button>
            </div>
          </div>
          <p className="font-serif text-h3 text-text-primary">{current.title || "(untitled)"}</p>
          <p className="whitespace-pre-wrap text-body-sm text-text-body">{current.notes || "(no notes)"}</p>
        </Card>
      )}

      <Card className="space-y-4">
        <PracticeRecorder
          script={reference}
          contentLabel={prep.mode === "slides" ? "Current slide" : "Your notes"}
          onComplete={({ transcript, durationSec, nonverbal, audio }) => {
            const stopAt = Date.now();
            const startAt = stopAt - durationSec * 1000;
            const sig = computeSignals({ nonverbal, audio, transcript, durationSec });
            onResult({
              transcript,
              durationSec: Math.round(durationSec),
              nonverbal,
              signals: sig,
              effective: computeEffective(PRESENTATION_RUBRIC, sig),
              slideTimings: slides.length ? accumulateTimings(changes.current, startAt, stopAt) : null,
            });
          }}
        />

        <div>
          <label htmlFor="run-transcript" className="block text-body-sm font-medium text-text-primary">
            What you said
            {!speechSupported && (
              <span className="ml-2 font-normal text-text-muted">
                (speech-to-text unavailable in this browser — type it here)
              </span>
            )}
          </label>
          <Textarea
            id="run-transcript"
            value={result?.transcript ?? ""}
            onChange={(e) => onTranscript(e.target.value)}
            rows={6}
            maxLength={PRESENTATION_LIMITS.transcript}
            placeholder="Your recorded words appear here. Edit as needed before getting feedback."
            style={{ marginTop: 6 }}
          />
        </div>

        {result?.effective && <EffectiveScore result={result.effective} signals={result.signals} compact />}

        <div className="flex flex-wrap gap-3">
          <Button onClick={onGetFeedback} disabled={!result?.transcript.trim()} iconAfter="arrow-right">
            Get feedback
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Edit setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

Note: `onTranscript` edits must keep the rest of `result` (the session merges it; when no take exists yet it creates `{ transcript, durationSec: 0, nonverbal: null, signals: null, effective: null, slideTimings: null }` so typed-only runs still work).

- [ ] **Step 4: Create `components/PresentationHistory.tsx`**

```tsx
"use client";

import { useState } from "react";
import PresentationFeedbackSections from "./PresentationFeedbackSections";
import { formatDuration } from "@/lib/presentationPrep";
import type { PresentationTake } from "@/lib/types";
import { Card, Icon, IconButton } from "@/components/ui";

interface Props {
  takes: PresentationTake[];
  onDelete: (id: string) => void;
}

export default function PresentationHistory({ takes, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  if (!takes.length) {
    return (
      <Card tone="sunken" padding="sm">
        <p className="text-body-sm text-text-muted">Your runs will show up here.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-h4 text-text-primary">Past runs</h2>
      {takes.map((t) => (
        <Card key={t.id} tone="sunken" padding="sm" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === t.id ? null : t.id)}
              className="flex flex-1 items-center gap-2 text-left text-body-sm text-text-body"
            >
              <Icon name={open === t.id ? "chevron-down" : "chevron-right"} size={14} />
              <span className="font-medium text-text-primary">
                {new Date(t.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-text-muted">· {formatDuration(t.durationSec)}</span>
              {t.effective && <span className="text-text-muted">· Effective {Math.round(t.effective.score)}</span>}
              {t.talkTitle && <span className="truncate text-text-muted">· {t.talkTitle}</span>}
            </button>
            <IconButton icon="trash-2" label="Delete this run" onClick={() => onDelete(t.id)} />
          </div>
          {open === t.id && <PresentationFeedbackSections feedback={t.feedback} />}
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `components/PresentationSession.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PresentationSetup from "./PresentationSetup";
import PresentationRun, { type RunResult } from "./PresentationRun";
import PresentationFeedbackSections from "./PresentationFeedbackSections";
import PresentationHistory from "./PresentationHistory";
import EffectiveScore from "./EffectiveScore";
import NonverbalSummary from "./NonverbalSummary";
import FeedbackWidget from "./FeedbackWidget";
import { DEMO_LIMIT_MESSAGE, postJSON, type FetchError } from "@/lib/clientFetch";
import {
  deleteTake,
  loadPresentationPrep,
  loadTakes,
  savePresentationPrep,
  saveTake,
} from "@/lib/presentationStore";
import { emptyPresentationPrep, presentationHasContent } from "@/lib/presentationPrep";
import { shouldPersist } from "@/lib/interviewRound";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import type { PresentationFeedbackResponse, PresentationPrep, PresentationTake } from "@/lib/types";
import { Button, Callout, Card } from "@/components/ui";

// /prep/presentation: setup (persisted) -> run (one continuous take) ->
// feedback (take saved to history only after feedback succeeds).

type Stage = "loading" | "setup" | "run" | "feedback-loading" | "feedback";

const SAVE_DEBOUNCE_MS = 800;
const EMPTY_RESULT: RunResult = {
  transcript: "", durationSec: 0, nonverbal: null, signals: null, effective: null, slideTimings: null,
};

export default function PresentationSession() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prep, setPrep] = useState<PresentationPrep>(emptyPresentationPrep);
  const [takes, setTakes] = useState<PresentationTake[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [takeWarning, setTakeWarning] = useState<string | null>(null);

  // Same data-safety rules as the interview page (see lib/interviewRound.ts):
  // save only after a successful load; flush a pending save on leave.
  const loaded = useRef(false);
  const lastSaved = useRef("");
  const latestPrep = useRef(prep);
  latestPrep.current = prep;

  useEffect(() => {
    loadPresentationPrep()
      .catch(() => new Promise((r) => setTimeout(r, 1000)).then(loadPresentationPrep))
      .then((p) => {
        loaded.current = true;
        lastSaved.current = JSON.stringify(p);
        setPrep(p);
      })
      .catch((err) => {
        reportClientError(err, { area: "presentation:load" });
        setSaveWarning("Couldn't load your saved setup. You can still practice, but changes won't be saved this visit.");
      })
      .finally(() => setStage("setup"));
    loadTakes()
      .then(setTakes)
      .catch((err) => reportClientError(err, { area: "presentation:load-takes" }));
  }, []);

  function persistIfChanged(state: PresentationPrep, keepalive = false) {
    const snapshot = JSON.stringify(state);
    if (!shouldPersist({ loaded: loaded.current, snapshot, lastSaved: lastSaved.current })) return;
    if (keepalive) lastSaved.current = snapshot;
    savePresentationPrep(state, { keepalive })
      .then(() => {
        lastSaved.current = snapshot;
        setSaveWarning(null);
      })
      .catch((err) => {
        if (keepalive) return;
        reportClientError(err, { area: "presentation:save" });
        setSaveWarning("Couldn't save your setup. You can still practice; changes may not be there next time.");
      });
  }

  useEffect(() => {
    if (stage !== "setup") return;
    const t = setTimeout(() => persistIfChanged(prep), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, stage]);

  useEffect(() => {
    const flush = () => persistIfChanged(latestPrep.current, true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startRun() {
    persistIfChanged(prep);
    track(EVENTS.presentationSetupSaved, {
      mode: prep.mode,
      slide_count: prep.mode === "slides" ? prep.slides.length : 0,
      has_audience: Boolean(prep.audience.trim()),
      has_time_limit: prep.timeLimitMin != null,
    });
    setResult(null);
    setFeedback(null);
    setError(null);
    setDemoLimited(false);
    setTakeWarning(null);
    setStage("run");
  }

  async function getFeedback() {
    if (!result?.transcript.trim()) return;
    setError(null);
    setDemoLimited(false);
    setStage("feedback-loading");
    try {
      const data = await postJSON<PresentationFeedbackResponse>("/api/presentation-feedback", {
        prep,
        transcript: result.transcript,
        durationSec: result.durationSec,
        slideTimings: result.slideTimings,
        nonverbal: result.nonverbal,
        signals: result.signals,
      });
      setFeedback(data.feedback);
      setStage("feedback");
      track(EVENTS.presentationFeedbackReceived, {
        effective_score: result.effective ? Math.round(result.effective.score) : null,
        effective_band: result.effective ? result.effective.label : null,
        used_video: result.nonverbal != null,
      });
      saveTake({
        talkTitle: prep.title,
        durationSec: result.durationSec,
        transcript: result.transcript,
        feedback: data.feedback,
        effective: result.effective,
        nonverbal: result.nonverbal,
        slideTimings: result.slideTimings,
      })
        .then((t) => setTakes((prev) => [t, ...prev].slice(0, 50)))
        .catch((err) => {
          reportClientError(err, { area: "presentation:save-take" });
          setTakeWarning("Couldn't save this run to your history.");
        });
    } catch (err) {
      if ((err as FetchError)?.demoLimited) setDemoLimited(true);
      else {
        reportClientError(err, { area: "presentation:feedback" });
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setStage("run");
    }
  }

  function removeTake(id: string) {
    setTakes((prev) => prev.filter((t) => t.id !== id));
    deleteTake(id).catch((err) => {
      reportClientError(err, { area: "presentation:delete-take" });
      loadTakes().then(setTakes).catch(() => {});
    });
  }

  const notices = (
    <>
      {demoLimited && <Callout tone="caution">{DEMO_LIMIT_MESSAGE}</Callout>}
      {error && !demoLimited && <Callout tone="critical">{error}</Callout>}
    </>
  );

  let main: ReactNode;
  if (stage === "loading") {
    main = (
      <Card>
        <p className="text-body-sm text-text-muted">Loading your setup…</p>
      </Card>
    );
  } else if (stage === "setup") {
    const ready = presentationHasContent(prep);
    main = (
      <div className="space-y-6">
        {saveWarning && <Callout tone="caution">{saveWarning}</Callout>}
        <PresentationSetup value={prep} onChange={setPrep} />
        <Button onClick={startRun} disabled={!ready} iconAfter="arrow-right">
          Start run-through
        </Button>
        {!ready && (
          <p className="text-caption text-text-muted">
            Add your notes, or at least one slide with a title or notes, to start.
          </p>
        )}
      </div>
    );
  } else if (stage === "run") {
    main = (
      <div className="space-y-4">
        <PresentationRun
          prep={prep}
          result={result}
          onResult={(r) => {
            setResult(r);
            track(EVENTS.presentationTakeCompleted, {
              used_video: r.nonverbal != null,
              duration_sec: r.durationSec,
              slide_count: prep.mode === "slides" ? prep.slides.length : 0,
            });
          }}
          onTranscript={(t) => setResult((prev) => ({ ...(prev ?? EMPTY_RESULT), transcript: t }))}
          onGetFeedback={getFeedback}
          onBack={() => setStage("setup")}
        />
        {notices}
      </div>
    );
  } else if (stage === "feedback-loading") {
    main = (
      <Card>
        <p className="text-body-sm text-text-muted">Putting together your feedback…</p>
      </Card>
    );
  } else {
    main = (
      <div className="space-y-6">
        {result?.effective && <EffectiveScore result={result.effective} signals={result.signals} />}
        {result?.nonverbal && <NonverbalSummary metrics={result.nonverbal} />}
        {feedback && (
          <Card padding="lg">
            <h2 className="mb-5 text-h4 text-text-primary">How it went</h2>
            <PresentationFeedbackSections feedback={feedback} />
          </Card>
        )}
        {takeWarning && <Callout tone="caution">{takeWarning}</Callout>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={startRun} icon="rotate-ccw">Run it again</Button>
          <Button variant="secondary" onClick={() => setStage("setup")}>Edit setup</Button>
        </div>
        <FeedbackWidget
          surveyKey="presentation_feedback_rating"
          surveyName="Presentation feedback"
          question="How useful was this run-through feedback?"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{main}</div>
      <aside>
        <PresentationHistory takes={takes} onDelete={removeTake} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 6: Create `app/prep/presentation/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import PresentationSession from "@/components/PresentationSession";

export const metadata: Metadata = {
  title: "Presentation practice · VocalGym",
  description: "Rehearse a talk from your notes or slides and see what you covered.",
};

export default function PresentationPrepPage() {
  return (
    <main className="mx-auto max-w-container px-4 py-12 sm:px-8 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Rehearse your talk</h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Bring your speaker notes or slides, run the whole talk out loud, and
            see which points landed — plus how you delivered them.
          </p>
        </div>
        <Link
          href="/prep"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Back
        </Link>
      </header>
      <PresentationSession />
    </main>
  );
}
```

- [ ] **Step 7: Make the hub card live** — in `app/prep/page.tsx`, replace the whole disabled Presentation `<Card tone="sunken" …>…</Card>` with:

```tsx
        <Card as={Link} href="/prep/presentation" interactive className="group flex flex-col no-underline">
          <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
            <Icon name="presentation" size={16} />
            Presentation
          </span>
          <span className="mt-1.5 flex-1 text-body-sm text-text-body">
            Rehearse a talk from your speaker notes or slides.
          </span>
          <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-text-accent">
            Start
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </Card>
```

Remove the now-unused `Badge` import from `app/prep/page.tsx` if nothing else uses it.

- [ ] **Step 8: Type-check, test, build**

Run: `npx tsc --noEmit && npm test`
Expected: clean / PASS.
Stop any dev server, then run `npm run build` → succeeds, route list includes `/prep/presentation`, `/api/presentation-prep`, `/api/presentation-takes`, `/api/presentation-takes/[id]`, `/api/presentation-feedback`.

- [ ] **Step 9: Browser verification** (dev server running; drive with the chrome skill; if synthetic clicks don't reach the page, drive via page JS as in the interview work and record that as a ruling)

1. `/prep` → Presentation card links to `/prep/presentation`.
2. Setup: Start disabled when empty; Notes mode with text → enabled; Slides mode with only blank slides → disabled.
3. Build a real `.pptx` (e.g. with `python3 -c "import pptx"` if available, else construct via the `buildPptx` test helper + `zipSync` into a file in the scratchpad) with 3 slides (one without notes, one containing `&`), import it → rows show titles/notes in order, info note appears; re-import shows the inline confirm; a `.ppt` file shows "Save it as .pptx and try again."
4. Refresh → setup restored (mode, slides, audience, time limit).
5. Run: step prev/next, record (or type a transcript if the mic is unavailable), stop → Effective score shows → Get feedback → feedback sections render → run appears at the top of Past runs; expand shows feedback; delete removes it.
6. `/practice` history does not contain the presentation run.
7. Reset the test setup: `PUT /api/presentation-prep` with `{}` and delete test takes.

- [ ] **Step 10: Commit**

```bash
git add lib/analytics.ts components/PresentationRun.tsx components/PresentationFeedbackSections.tsx components/PresentationHistory.tsx components/PresentationSession.tsx app/prep/presentation app/prep/page.tsx
git commit -m "Add /prep/presentation run-through, feedback, and history UI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs

**Files:** Modify `CLAUDE.md`, `README.md`

- [ ] **Step 1: CLAUDE.md**
  - Tech stack: add `fflate` (client-side `.pptx` unzip, dynamically imported by `SlideListEditor` only).
  - Architecture → `/prep` bullet: Presentation card is live.
  - Add a `/prep/presentation` (`PresentationSession`) bullet: stages; setup (notes vs. slides mode, both kept; `.pptx` import via `lib/pptxImport.ts` — `sldIdLst` order, title/ctrTitle placeholder, notes body minus sldNum/sldImg/hdr/ftr/dt, 40 slides / 20,000 notes chars, later slides cut first); run (continuous take, slide stepper, `accumulateTimings` derives per-slide seconds from the recording window `stopAt - durationSec`); Effective score with fixed `PRESENTATION_RUBRIC` (Clear 30 · Confident 25 · Connected 25 · Smooth 20 — NOT a Tone); `POST /api/presentation-feedback` (sections, `verifyPresentationFeedback`, recompute score server-side); takes saved via `POST /api/presentation-takes` only after feedback succeeds; history newest 50; same load-guard + leave-flush as interviews via `shouldPersist`.
  - Persistence → Models: `PresentationPrep` (1:1, `prep` Json), `PresentationTake` (newest 50/session, never in `Attempt`). API list: the four new routes.
  - Usage cap + Observability lists: add `/api/presentation-feedback` (nine Claude routes).
  - Analytics: the 3 events + `presentation_feedback_rating`.
  - Not yet built: remove "Presentation mode"; add "Presentation follow-ups: audience Q&A after the talk, drill-one-slide mode, numeric coverage score (content-scored qualities)".
- [ ] **Step 2: README.md** — project structure entries for every new file; Database table rows for the two models; Observability/verification + Demo usage cap lists include `presentation-feedback`; Product analytics events; a "Presentation mode (`/prep/presentation`)" section mirroring the interview section (setup / run / feedback / history, v1 scope, privacy); update the intro paragraph (presentation mode is live).
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document presentation mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
