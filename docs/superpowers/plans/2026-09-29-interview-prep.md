# Interview Prep (Mock Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/prep/interview` — describe a 1–4 person interview panel (plus optional job description / resume / key points), run a 4–5 question spoken mock interview with adaptive follow-ups, and get grounded feedback — reachable from a secondary strip on `/` via a `/prep` hub.

**Architecture:** A new isolated feature alongside `/grill`. Panel setup persists in a new `InterviewPrep` Prisma table (one row per anonymous session) behind `GET/PUT /api/interview-prep`. Three new Claude routes (`interview-questions`, `interview-followup`, `interview-feedback`) follow the existing `/grill` route pattern (logger + Sentry + `verifyOutput` + shared usage cap). Pure logic (normalization, prompt building, parsing, verification) lives in `lib/` and is unit-tested with Vitest; the client is a small state machine component reusing `PracticeRecorder`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 6 / Neon Postgres, `@anthropic-ai/sdk`, Tailwind + `components/ui` design-system primitives, Vitest (new), PostHog via `lib/analytics.ts`.

**Spec:** `docs/superpowers/specs/2026-09-29-interview-prep-design.md`

## Global Constraints

- Keep features additive/isolated: do NOT modify `/grill`, `/script`, `/generate`, `/practice` or their components/routes. The only edits to existing files are additive: `lib/types.ts`, `lib/prompt.ts`, `lib/anthropic.ts`, `lib/verifyOutput.ts`, `lib/analytics.ts` (`EVENTS`), `prisma/schema.prisma`, `app/page.tsx` (one strip), `package.json`, `CLAUDE.md`, `README.md`.
- Style only with `components/ui` primitives + token Tailwind utilities (`text-text-primary`, `bg-surface-sunken`, `border-border-subtle`, `text-h2`, `font-serif`, …). No `bg-slate-*`, no new colors. Notices are `<Callout tone="info" | "caution" | "critical">`.
- Icons only from the `Icon` REGISTRY (`components/ui/Icon.tsx`) — use existing names (`message-square`, `presentation`, `upload`, `arrow-right`, `x`, `rotate-ccw`); don't add glyphs.
- All Claude calls use `MODEL` from `lib/anthropic.ts`; every Claude route calls `recordRequest()` before calling Anthropic and returns the existing 429 `{ code: "demo_limit_reached" }` shape when blocked.
- Analytics props are primitives only (counts/booleans). NEVER pass interviewer text, names, transcripts, feedback, job description, resume, or key points to `track()`.
- Server DB access only through the `prisma` singleton (`lib/prisma.ts`).
- Limits (verbatim from spec): panel 1–4; name/title/company 120 chars; about 8,000; pastQuestions 2,000; jobDescription 8,000; background 8,000; keyPoints ≤5 × 200 chars. Over-limit text is truncated, not rejected.
- Plan: 3–6 questions (prompt asks for 4–5), each ends in "?" and ≤400 chars; failure → 502 `code: "interview_plan_malformed"`. Follow-up malformed → 200 `{ followUp: null }` (logged + Sentry). Feedback missing sections → 502 `code: "feedback_incomplete"`.
- Commits: each commit auto-pushes via the local post-commit hook (branch `feature/interview-prep`). End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Unnamed interviewers** — a panelist with no name/title must still be attributed ("Interviewer 2") in the UI and tagged `P2` in prompts. Pinned by `panelistLabel` tests (Task 1) and `buildInterviewContext` tests (Task 3).
2. **Model tags a question for a panelist that doesn't exist** (e.g. `P3:` with a 2-person panel) or formats lines as `- **P1:** …` / `1. P1 — …` — tolerant parsing, but unknown tags must fail verification rather than render "undefined asks:". Pinned in Task 3 tests.
3. **Follow-up reply variants** — `NONE.`, `none — the answer was complete`, `"NONE"` must all mean "no follow-up", while a real question starting with "None of…?" must not. Pinned in Task 4 tests.
4. **Ending early while a follow-up is on screen but unanswered** — the feedback prompt must not include a follow-up without an answer (Claude would otherwise critique a non-answer). Pinned in Task 5 `buildInterviewFeedbackPrompt` test and `normalizeExchanges` tests (Task 1).
5. **Pasting a huge LinkedIn dump / 6 interviewers / duplicate ids from a hand-crafted request** — normalization truncates, caps the panel at 4, and de-duplicates ids so `panelistId` lookups stay unambiguous. Pinned in Task 1 tests.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `vitest.config.ts` | create | Vitest config, `@/` alias |
| `lib/types.ts` | modify (append) | Interview types |
| `lib/interviewPrep.ts` | create | Pure: limits, `normalizePrep`, `normalizeExchanges`, `panelistLabel`, `hasPanelContent`, `emptyPanelist`, `emptyPrep` |
| `lib/interviewPrep.test.ts` | create | Tests for the above |
| `prisma/schema.prisma` | modify | `InterviewPrep` model + `Session.interviewPrep` relation |
| `prisma/migrations/<ts>_interview_prep/` | generated | Migration |
| `lib/interviewPrep.server.ts` | create | `getPrep`, `savePrep` (Prisma) |
| `app/api/interview-prep/route.ts` | create | `GET` / `PUT` |
| `lib/interviewPrepStore.ts` | create | Client fetch wrappers `loadInterviewPrep` / `saveInterviewPrep` |
| `lib/claudeRoute.ts` | create | Shared `demoLimitResponse()` + `anthropicErrorResponse()` for the 3 new routes |
| `lib/prompt.ts` | modify (append) | `buildInterviewContext`, 3 system prompts + builders |
| `lib/prompt.interview.test.ts` | create | Prompt-builder tests |
| `lib/anthropic.ts` | modify (append) | `parseInterviewPlan`, `parseFollowUp`, `generateInterviewPlan`, `generateInterviewFollowUp`, `generateInterviewFeedback` |
| `lib/anthropic.interview.test.ts` | create | Parser tests |
| `lib/verifyOutput.ts` | modify (append) | `verifyInterviewPlan`, `verifyInterviewFeedback` |
| `lib/verifyOutput.interview.test.ts` | create | Verifier tests |
| `app/api/interview-questions/route.ts` | create | Plan route |
| `app/api/interview-followup/route.ts` | create | Follow-up route |
| `app/api/interview-feedback/route.ts` | create | Feedback route |
| `lib/clientFetch.ts` | create | Client `postJSON` + demo-limit error |
| `lib/analytics.ts` | modify | 4 new `EVENTS` |
| `components/PanelSetup.tsx` | create | Setup form (controlled) |
| `components/InterviewRound.tsx` | create | One question + recorder + transcript |
| `components/InterviewFeedbackSections.tsx` | create | Feedback markdown renderer |
| `components/InterviewSession.tsx` | create | State machine; save/debounce; API calls; analytics |
| `app/prep/page.tsx` | create | Hub |
| `app/prep/interview/page.tsx` | create | Page shell |
| `app/page.tsx` | modify | Entry strip under path cards |
| `CLAUDE.md`, `README.md` | modify | Docs |

---

### Task 1: Vitest + interview types + pure normalization

**Files:**
- Create: `vitest.config.ts`, `lib/interviewPrep.ts`, `lib/interviewPrep.test.ts`
- Modify: `package.json` (devDependency + `test` script), `lib/types.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces (exact):
  - types in `lib/types.ts`: `InterviewPanelist`, `InterviewCandidate`, `InterviewPrepState`, `PlannedQuestion`, `InterviewExchange`, `InterviewQuestionsResponse`, `InterviewFollowUpRequest`, `InterviewFollowUpResponse`, `InterviewFeedbackRequest`, `InterviewFeedbackResponse`
  - `lib/interviewPrep.ts`: `PREP_LIMITS`, `emptyPanelist(id: string): InterviewPanelist`, `emptyPrep(): InterviewPrepState`, `normalizePrep(input: unknown): InterviewPrepState`, `normalizeExchanges(input: unknown): InterviewExchange[]`, `panelistHasContent(p: InterviewPanelist): boolean`, `hasPanelContent(state: InterviewPrepState): boolean`, `panelistLabel(p: InterviewPanelist, index: number): string`

- [ ] **Step 1: Install Vitest and add the script**

Run: `npm install -D vitest`

Then edit `package.json` `scripts`, adding after `"eval"`:

```json
    "eval": "tsx evals/run.ts",
    "test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure lib/ logic only (parsing, normalization, prompt building,
// output verification). UI flows are verified manually in the browser.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Append the interview types to `lib/types.ts`**

Append at the end of the file:

```ts
/**
 * Interview prep (app/prep/interview) — rehearse a mock interview with a
 * described panel. No script: the context is who's interviewing (anything
 * known about each person) plus optional candidate-side material. Separate
 * from the script/practice and "grill" types; no rubric/Effective score in v0.
 */
export interface InterviewPanelist {
  /** Client-generated (newId), stable across edits. */
  id: string;
  name: string;
  title: string;
  company: string;
  /** Anything known: bio, pasted LinkedIn text, their writing, history. */
  about: string;
  /** Questions they've asked before (free text). */
  pastQuestions: string;
}

export interface InterviewCandidate {
  jobDescription: string;
  /** Resume / notes on experience. */
  background: string;
  keyPoints: string[];
}

export interface InterviewPrepState {
  panel: InterviewPanelist[];
  candidate: InterviewCandidate;
}

export interface PlannedQuestion {
  panelistId: string;
  question: string;
}

/** One planned question, the spoken answer, and (optionally) one follow-up. */
export interface InterviewExchange {
  panelistId: string;
  question: string;
  transcript: string;
  followUp?: string;
  followUpTranscript?: string;
}

export type InterviewQuestionsRequest = InterviewPrepState;

export interface InterviewQuestionsResponse {
  questions: PlannedQuestion[];
}

export interface InterviewFollowUpRequest extends InterviewPrepState {
  panelistId: string;
  question: string;
  transcript: string;
  /** Planned questions still to come, so the follow-up doesn't duplicate them. */
  upcomingQuestions: string[];
}

export interface InterviewFollowUpResponse {
  /** null = the answer was complete; move to the next planned question. */
  followUp: string | null;
}

export interface InterviewFeedbackRequest extends InterviewPrepState {
  exchanges: InterviewExchange[];
}

export interface InterviewFeedbackResponse {
  feedback: string;
}
```

- [ ] **Step 3: Write the failing tests** — create `lib/interviewPrep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PREP_LIMITS,
  emptyPanelist,
  emptyPrep,
  hasPanelContent,
  normalizeExchanges,
  normalizePrep,
  panelistLabel,
} from "./interviewPrep";

describe("normalizePrep", () => {
  it("returns one blank panelist and an empty candidate for junk input", () => {
    for (const input of [null, undefined, 42, "x", {}, { panel: [] }]) {
      const s = normalizePrep(input);
      expect(s.panel).toHaveLength(1);
      expect(s.panel[0]).toMatchObject({ name: "", about: "" });
      expect(s.panel[0].id).toBeTruthy();
      expect(s.candidate).toEqual({ jobDescription: "", background: "", keyPoints: [] });
    }
  });

  it("caps the panel at 4", () => {
    const panel = Array.from({ length: 6 }, (_, i) => ({ id: `id${i}`, name: `N${i}` }));
    expect(normalizePrep({ panel }).panel).toHaveLength(PREP_LIMITS.panelMax);
  });

  it("truncates every field to its limit", () => {
    const long = "x".repeat(20_000);
    const s = normalizePrep({
      panel: [{ id: "a", name: long, title: long, company: long, about: long, pastQuestions: long }],
      candidate: { jobDescription: long, background: long, keyPoints: [long] },
    });
    const p = s.panel[0];
    expect(p.name).toHaveLength(120);
    expect(p.title).toHaveLength(120);
    expect(p.company).toHaveLength(120);
    expect(p.about).toHaveLength(8000);
    expect(p.pastQuestions).toHaveLength(2000);
    expect(s.candidate.jobDescription).toHaveLength(8000);
    expect(s.candidate.background).toHaveLength(8000);
    expect(s.candidate.keyPoints[0]).toHaveLength(200);
  });

  it("coerces non-strings to empty strings and drops unknown keys", () => {
    const s = normalizePrep({
      panel: [{ id: "a", name: 5, about: { x: 1 }, evil: "y" }],
      candidate: { jobDescription: [], extra: 1 },
    });
    expect(s.panel[0]).toEqual({
      id: "a", name: "", title: "", company: "", about: "", pastQuestions: "",
    });
    expect(Object.keys(s.candidate).sort()).toEqual(["background", "jobDescription", "keyPoints"]);
  });

  it("keeps at most 5 key points, trimmed, blanks dropped", () => {
    const s = normalizePrep({
      candidate: { keyPoints: ["  a  ", "", "   ", "b", 7, "c", "d", "e", "f"] },
    });
    expect(s.candidate.keyPoints).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("assigns ids to panelists missing one and de-duplicates ids", () => {
    const s = normalizePrep({ panel: [{ name: "A" }, { id: "dup" }, { id: "dup" }] });
    const ids = s.panel.map((p) => p.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBe("dup");
  });
});

describe("hasPanelContent", () => {
  it("is false for a blank panel and true once any panelist field has text", () => {
    expect(hasPanelContent(emptyPrep())).toBe(false);
    const s = emptyPrep();
    s.panel.push({ ...emptyPanelist("b"), company: "  Acme " });
    expect(hasPanelContent(s)).toBe(true);
    expect(hasPanelContent({ ...emptyPrep(), panel: [{ ...emptyPanelist("c"), about: "   " }] })).toBe(false);
  });
});

describe("panelistLabel", () => {
  it("uses name and title when present", () => {
    expect(panelistLabel({ ...emptyPanelist("a"), name: "Priya Shah", title: "VP Engineering" }, 0))
      .toBe("Priya Shah · VP Engineering");
  });
  it("falls back to 'Interviewer N' (1-based) when unnamed", () => {
    expect(panelistLabel(emptyPanelist("a"), 1)).toBe("Interviewer 2");
    expect(panelistLabel({ ...emptyPanelist("a"), title: "Recruiter" }, 2)).toBe("Interviewer 3 · Recruiter");
  });
});

describe("normalizeExchanges", () => {
  it("drops malformed entries and exchanges without an answer", () => {
    const ex = normalizeExchanges([
      null,
      { panelistId: "a", question: "Q1?", transcript: "answer" },
      { panelistId: "a", question: "Q2?", transcript: "   " },
      { panelistId: 3, question: "Q3?", transcript: "x" },
    ]);
    expect(ex).toEqual([{ panelistId: "a", question: "Q1?", transcript: "answer" }]);
  });

  it("keeps a follow-up only when it was actually answered", () => {
    const ex = normalizeExchanges([
      { panelistId: "a", question: "Q1?", transcript: "x", followUp: "F1?", followUpTranscript: "y" },
      { panelistId: "a", question: "Q2?", transcript: "x", followUp: "F2?", followUpTranscript: "" },
      { panelistId: "a", question: "Q3?", transcript: "x", followUp: "F3?" },
    ]);
    expect(ex[0]).toEqual({ panelistId: "a", question: "Q1?", transcript: "x", followUp: "F1?", followUpTranscript: "y" });
    expect(ex[1]).toEqual({ panelistId: "a", question: "Q2?", transcript: "x" });
    expect(ex[2]).toEqual({ panelistId: "a", question: "Q3?", transcript: "x" });
  });

  it("returns [] for non-arrays and caps at 10 exchanges", () => {
    expect(normalizeExchanges("nope")).toEqual([]);
    const many = Array.from({ length: 15 }, () => ({ panelistId: "a", question: "Q?", transcript: "x" }));
    expect(normalizeExchanges(many)).toHaveLength(10);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./interviewPrep"`.

- [ ] **Step 5: Implement `lib/interviewPrep.ts`**

```ts
import type {
  InterviewCandidate,
  InterviewExchange,
  InterviewPanelist,
  InterviewPrepState,
} from "./types";

// Pure normalization for interview prep (app/prep/interview). Used by the
// server before storing / prompting, and by the client when hydrating. No
// Prisma/React here so it's unit-testable and safe on both sides.

export const PREP_LIMITS = {
  panelMax: 4,
  short: 120, // name / title / company
  about: 8000,
  pastQuestions: 2000,
  jobDescription: 8000,
  background: 8000,
  keyPointsMax: 5,
  keyPoint: 200,
  id: 100,
  exchangesMax: 10,
  question: 500,
  transcript: 12000,
} as const;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function emptyPanelist(id: string): InterviewPanelist {
  return { id, name: "", title: "", company: "", about: "", pastQuestions: "" };
}

export function emptyPrep(): InterviewPrepState {
  return {
    panel: [emptyPanelist("p1")],
    candidate: { jobDescription: "", background: "", keyPoints: [] },
  };
}

function normalizeCandidate(v: unknown): InterviewCandidate {
  const c = obj(v);
  const keyPoints = Array.isArray(c.keyPoints)
    ? c.keyPoints
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim().slice(0, PREP_LIMITS.keyPoint))
        .filter(Boolean)
        .slice(0, PREP_LIMITS.keyPointsMax)
    : [];
  return {
    jobDescription: str(c.jobDescription, PREP_LIMITS.jobDescription),
    background: str(c.background, PREP_LIMITS.background),
    keyPoints,
  };
}

/** Validate/truncate an untrusted prep blob. Never throws. Always returns 1–4
 *  panelists with unique, non-empty ids. */
export function normalizePrep(input: unknown): InterviewPrepState {
  const raw = obj(input);
  const rawPanel = Array.isArray(raw.panel)
    ? raw.panel.slice(0, PREP_LIMITS.panelMax)
    : [];

  const seen = new Set<string>();
  const panel = rawPanel.map((v, i): InterviewPanelist => {
    const p = obj(v);
    let id = str(p.id, PREP_LIMITS.id).trim() || `p${i + 1}`;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return {
      id,
      name: str(p.name, PREP_LIMITS.short),
      title: str(p.title, PREP_LIMITS.short),
      company: str(p.company, PREP_LIMITS.short),
      about: str(p.about, PREP_LIMITS.about),
      pastQuestions: str(p.pastQuestions, PREP_LIMITS.pastQuestions),
    };
  });

  return {
    panel: panel.length ? panel : emptyPrep().panel,
    candidate: normalizeCandidate(raw.candidate),
  };
}

export function panelistHasContent(p: InterviewPanelist): boolean {
  return [p.name, p.title, p.company, p.about, p.pastQuestions].some(
    (f) => f.trim().length > 0,
  );
}

/** At least one interviewer has something filled in — the "Start" gate. */
export function hasPanelContent(state: InterviewPrepState): boolean {
  return state.panel.some(panelistHasContent);
}

/** "Priya Shah · VP Engineering", falling back to "Interviewer N" (1-based). */
export function panelistLabel(p: InterviewPanelist, index: number): string {
  const who = p.name.trim() || `Interviewer ${index + 1}`;
  const title = p.title.trim();
  return title ? `${who} · ${title}` : who;
}

/** Validate untrusted exchanges for the feedback call. Drops unanswered
 *  exchanges, and drops a follow-up that was shown but never answered (the
 *  user ended early) so Claude never critiques a non-answer. */
export function normalizeExchanges(input: unknown): InterviewExchange[] {
  if (!Array.isArray(input)) return [];
  const out: InterviewExchange[] = [];
  for (const v of input) {
    if (out.length >= PREP_LIMITS.exchangesMax) break;
    const e = obj(v);
    if (typeof e.panelistId !== "string" || typeof e.question !== "string") continue;
    const question = e.question.trim().slice(0, PREP_LIMITS.question);
    const transcript = str(e.transcript, PREP_LIMITS.transcript).trim();
    if (!question || !transcript) continue;
    const ex: InterviewExchange = {
      panelistId: e.panelistId.slice(0, PREP_LIMITS.id),
      question,
      transcript,
    };
    const followUp = str(e.followUp, PREP_LIMITS.question).trim();
    const followUpTranscript = str(e.followUpTranscript, PREP_LIMITS.transcript).trim();
    if (followUp && followUpTranscript) {
      ex.followUp = followUp;
      ex.followUpTranscript = followUpTranscript;
    }
    out.push(ex);
  }
  return out;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all `lib/interviewPrep.test.ts` tests).

Also run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/types.ts lib/interviewPrep.ts lib/interviewPrep.test.ts
git commit -m "Add Vitest and pure interview-prep types + normalization

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Persistence — Prisma model, server module, API route, client store

**Files:**
- Modify: `prisma/schema.prisma`
- Generated: `prisma/migrations/<timestamp>_interview_prep/migration.sql`
- Create: `lib/interviewPrep.server.ts`, `app/api/interview-prep/route.ts`, `lib/interviewPrepStore.ts`

**Interfaces:**
- Consumes: `normalizePrep`, `emptyPrep` (Task 1); `ensureSession`, `getSessionId` (`lib/session.ts`); `logError`, `newRequestId` (`lib/logger.ts`).
- Produces:
  - `lib/interviewPrep.server.ts`: `getPrep(sessionId: string): Promise<InterviewPrepState>`, `savePrep(sessionId: string, input: unknown): Promise<InterviewPrepState>`
  - `GET /api/interview-prep` → `InterviewPrepState`; `PUT /api/interview-prep` (body `InterviewPrepState`) → stored `InterviewPrepState`
  - `lib/interviewPrepStore.ts` (client): `loadInterviewPrep(): Promise<InterviewPrepState>`, `saveInterviewPrep(state: InterviewPrepState): Promise<void>`

No unit tests here (DB-bound; normalization is already tested). Verified with curl against the dev server.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

In `model Session`, add after `attempts Attempt[]`:

```prisma
  attempts Attempt[]

  interviewPrep InterviewPrep?
```

Append at the end of the file:

```prisma
/// Interview-prep setup (panel + candidate context) for /prep/interview.
/// One per session. Rounds themselves are not persisted in v0.
model InterviewPrep {
  id        String   @id @default(cuid())
  sessionId String   @unique
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  /// InterviewPanelist[] (lib/types.ts), 1–4 entries.
  panel     Json
  /// InterviewCandidate (lib/types.ts).
  candidate Json
}
```

- [ ] **Step 2: Create and apply the migration**

This applies to the database in `DATABASE_URL` (the dev Neon DB in `.env`). It only creates a new table — no existing data is touched.

Run: `npm run db:migrate -- --name interview_prep`
Expected: `The following migration(s) have been created and applied … _interview_prep` and `Generated Prisma Client`. A new folder `prisma/migrations/<timestamp>_interview_prep/` containing `CREATE TABLE "InterviewPrep"`.

- [ ] **Step 3: Create `lib/interviewPrep.server.ts`**

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureSession } from "./session";
import { normalizePrep } from "./interviewPrep";
import type { InterviewPrepState } from "./types";

// Server data layer for interview prep (app/prep/interview). One row per
// session; everything is normalized (lib/interviewPrep.ts) on the way in and
// out, so a hand-crafted request can't store oversized or malformed blobs.

export async function getPrep(sessionId: string): Promise<InterviewPrepState> {
  const row = await prisma.interviewPrep.findUnique({ where: { sessionId } });
  return normalizePrep(row ? { panel: row.panel, candidate: row.candidate } : null);
}

export async function savePrep(
  sessionId: string,
  input: unknown,
): Promise<InterviewPrepState> {
  const state = normalizePrep(input);
  await ensureSession(sessionId);
  const data = {
    panel: state.panel as unknown as Prisma.InputJsonValue,
    candidate: state.candidate as unknown as Prisma.InputJsonValue,
  };
  await prisma.interviewPrep.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
  return state;
}
```

- [ ] **Step 4: Create `app/api/interview-prep/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { getPrep, savePrep } from "@/lib/interviewPrep.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-prep";

// Per-session interview-prep setup (panel + candidate context). Contains
// third-party personal data (interviewer profiles) — never logged, never sent
// to analytics.

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await getPrep(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't load your saved panel." },
      { status: 500 },
    );
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
    return NextResponse.json(await savePrep(getSessionId(), body));
  } catch (err) {
    logError(SCOPE, rid, `PUT failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't save your panel." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Create `lib/interviewPrepStore.ts`**

```ts
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
```

- [ ] **Step 6: Verify end-to-end with curl**

Run `npm run dev` in the background (note the port it prints — 3000 unless taken). If `SITE_PASSWORD` is set in `.env.local`, the gate will redirect curl; in that case verify in the browser devtools console instead with `fetch("/api/interview-prep")`.

```bash
curl -s -c /tmp/vg.jar http://localhost:3000/api/interview-prep
```
Expected: `{"panel":[{"id":"p1","name":"","title":"","company":"","about":"","pastQuestions":""}],"candidate":{"jobDescription":"","background":"","keyPoints":[]}}`

```bash
curl -s -b /tmp/vg.jar -X PUT -H 'Content-Type: application/json' \
  -d '{"panel":[{"id":"a","name":"Priya","title":"VP Eng"}],"candidate":{"keyPoints":["scale"," ",""]}}' \
  http://localhost:3000/api/interview-prep
curl -s -b /tmp/vg.jar http://localhost:3000/api/interview-prep
```
Expected: both return `panel[0].name == "Priya"` and `candidate.keyPoints == ["scale"]`.

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/interviewPrep.server.ts app/api/interview-prep/route.ts lib/interviewPrepStore.ts
git commit -m "Persist interview-prep panel setup per session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Question plan — context builder, prompt, parser, verifier, route

**Files:**
- Modify: `lib/prompt.ts` (append), `lib/anthropic.ts` (imports + append), `lib/verifyOutput.ts` (imports + append)
- Create: `lib/claudeRoute.ts`, `app/api/interview-questions/route.ts`, `lib/prompt.interview.test.ts`, `lib/anthropic.interview.test.ts`, `lib/verifyOutput.interview.test.ts`

**Interfaces:**
- Consumes: `normalizePrep`, `hasPanelContent` (Task 1); `recordRequest` (`lib/usageCounter.ts`); `logInfo`, `logError`, `newRequestId`.
- Produces:
  - `lib/prompt.ts`: `buildInterviewContext(prep: InterviewPrepState): string`, `panelTag(panel: InterviewPanelist[], panelistId: string): string` (returns `"P<n>"` or `"P?"`), `INTERVIEW_PLAN_SYSTEM_PROMPT`, `buildInterviewPlanPrompt(prep: InterviewPrepState): string`
  - `lib/anthropic.ts`: `parseInterviewPlan(text: string, panel: InterviewPanelist[]): PlannedQuestion[]`, `generateInterviewPlan(prep: InterviewPrepState): Promise<PlannedQuestion[]>`
  - `lib/verifyOutput.ts`: `verifyInterviewPlan(questions: unknown, panel: InterviewPanelist[]): QuestionsCheck`
  - `lib/claudeRoute.ts`: `demoLimitResponse(): NextResponse`, `anthropicErrorResponse(err: unknown, scope: string, rid: string): NextResponse`
  - `POST /api/interview-questions` body `InterviewPrepState` → `{ questions: PlannedQuestion[] }`

- [ ] **Step 1: Write the failing tests**

Create `lib/prompt.interview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildInterviewContext, panelTag } from "./prompt";
import { emptyPanelist, emptyPrep } from "./interviewPrep";
import type { InterviewPrepState } from "./types";

function prep(): InterviewPrepState {
  return {
    panel: [
      { ...emptyPanelist("a"), name: "Priya", title: "VP Eng", about: "Ex-Stripe, cares about scale" },
      emptyPanelist("b"),
    ],
    candidate: { jobDescription: "Staff engineer", background: "", keyPoints: ["Led migration"] },
  };
}

describe("buildInterviewContext", () => {
  it("tags interviewers P1..Pn in panel order", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).toContain('<interviewer tag="P1">');
    expect(ctx).toContain('<interviewer tag="P2">');
    expect(ctx.indexOf('tag="P1"')).toBeLessThan(ctx.indexOf("Priya"));
  });

  it("still emits a tag for an interviewer with no details", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).toMatch(/<interviewer tag="P2">\n\(no details given\)\n<\/interviewer>/);
  });

  it("omits empty fields and empty candidate sections", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).not.toContain("Company:");
    expect(ctx).not.toContain("<candidate_background>");
    expect(ctx).toContain("<job_description>\nStaff engineer\n</job_description>");
    expect(ctx).toContain("<key_points_to_land>\n- Led migration\n</key_points_to_land>");
    expect(buildInterviewContext(emptyPrep())).not.toContain("<job_description>");
  });
});

describe("panelTag", () => {
  it("maps ids to P<n> and unknown ids to P?", () => {
    const p = prep().panel;
    expect(panelTag(p, "a")).toBe("P1");
    expect(panelTag(p, "b")).toBe("P2");
    expect(panelTag(p, "zzz")).toBe("P?");
  });
});
```

Create `lib/anthropic.interview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseInterviewPlan } from "./anthropic";
import { emptyPanelist } from "./interviewPrep";

const panel = [emptyPanelist("a"), emptyPanelist("b")];

describe("parseInterviewPlan", () => {
  it("maps P<n> tags to panelist ids", () => {
    const out = parseInterviewPlan("P1: Why this role?\nP2: Tell me about a hard bug?", panel);
    expect(out).toEqual([
      { panelistId: "a", question: "Why this role?" },
      { panelistId: "b", question: "Tell me about a hard bug?" },
    ]);
  });

  it("tolerates bullets, numbering, bold and dash separators", () => {
    const text = [
      "Here is the plan:",
      "- **P1:** What drew you here?",
      "2. P2 — How do you handle on-call?",
      "3) **P1** - What would you do first?",
      "",
    ].join("\n");
    expect(parseInterviewPlan(text, panel).map((q) => q.panelistId)).toEqual(["a", "b", "a"]);
    expect(parseInterviewPlan(text, panel)[0].question).toBe("What drew you here?");
  });

  it("keeps out-of-range tags with an empty panelistId so verification fails", () => {
    expect(parseInterviewPlan("P3: Who are you?", panel)).toEqual([
      { panelistId: "", question: "Who are you?" },
    ]);
  });

  it("ignores lines without a tag", () => {
    expect(parseInterviewPlan("Sure! Here you go.\nThanks.", panel)).toEqual([]);
  });
});
```

Create `lib/verifyOutput.interview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { verifyInterviewPlan } from "./verifyOutput";
import { emptyPanelist } from "./interviewPrep";

const panel = [emptyPanelist("a"), emptyPanelist("b")];
const q = (panelistId: string, question = "What drew you to this role?") => ({ panelistId, question });

describe("verifyInterviewPlan", () => {
  it("accepts 3-6 complete questions from known panelists", () => {
    expect(verifyInterviewPlan([q("a"), q("b"), q("a"), q("b")], panel).ok).toBe(true);
  });
  it("rejects too few or too many", () => {
    expect(verifyInterviewPlan([q("a"), q("b")], panel)).toMatchObject({ ok: false, reason: "too-few" });
    expect(verifyInterviewPlan(Array(7).fill(q("a")), panel)).toMatchObject({ ok: false, reason: "too-many" });
    expect(verifyInterviewPlan("nope", panel)).toMatchObject({ ok: false });
  });
  it("rejects an unknown panelist", () => {
    expect(verifyInterviewPlan([q("a"), q(""), q("b")], panel)).toMatchObject({ ok: false, reason: "unknown-panelist" });
  });
  it("rejects a question cut off mid-sentence", () => {
    expect(verifyInterviewPlan([q("a"), q("b"), q("a", "Tell me about the time you")], panel))
      .toMatchObject({ ok: false, reason: "item-not-a-question" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `buildInterviewContext`/`panelTag`/`parseInterviewPlan`/`verifyInterviewPlan` are not exported.

- [ ] **Step 3: Append to `lib/prompt.ts`**

First extend the type import at the top of the file to:

```ts
import type {
  EffectiveResult,
  InterviewExchange,
  InterviewPanelist,
  InterviewPrepState,
  NonverbalMetrics,
  ObservableSignals,
  QAExchange,
  Tone,
} from "./types";
```

(`InterviewExchange` is used in Task 5; importing it now is harmless.)

Append at the end of the file:

```ts
// --- Interview prep (app/prep/interview) ------------------------------------

/** "P1".."Pn" for a panelist id (panel order), "P?" if not found. */
export function panelTag(panel: InterviewPanelist[], panelistId: string): string {
  const i = panel.findIndex((p) => p.id === panelistId);
  return i === -1 ? "P?" : `P${i + 1}`;
}

/** The shared panel + candidate context for all three interview prompts. XML
 *  tags with explicit closers, like the grill prompts: pasted LinkedIn text and
 *  resumes are full of their own headings and rules. Empty fields are omitted;
 *  an interviewer with nothing filled in still gets a tag so P-numbering stays
 *  aligned with the panel array. */
export function buildInterviewContext({ panel, candidate }: InterviewPrepState): string {
  const lines: string[] = ["<panel>"];
  panel.forEach((p, i) => {
    lines.push(`<interviewer tag="P${i + 1}">`);
    const before = lines.length;
    if (p.name.trim()) lines.push(`Name: ${p.name.trim()}`);
    if (p.title.trim()) lines.push(`Title: ${p.title.trim()}`);
    if (p.company.trim()) lines.push(`Company: ${p.company.trim()}`);
    if (p.about.trim()) {
      lines.push("<what_we_know>", p.about.trim(), "</what_we_know>");
    }
    if (p.pastQuestions.trim()) {
      lines.push(
        "<questions_they_have_asked_before>",
        p.pastQuestions.trim(),
        "</questions_they_have_asked_before>",
      );
    }
    if (lines.length === before) lines.push("(no details given)");
    lines.push("</interviewer>");
  });
  lines.push("</panel>");

  if (candidate.jobDescription.trim()) {
    lines.push("", "<job_description>", candidate.jobDescription.trim(), "</job_description>");
  }
  if (candidate.background.trim()) {
    lines.push("", "<candidate_background>", candidate.background.trim(), "</candidate_background>");
  }
  if (candidate.keyPoints.length) {
    lines.push(
      "",
      "<key_points_to_land>",
      candidate.keyPoints.map((k) => `- ${k}`).join("\n"),
      "</key_points_to_land>",
    );
  }
  return lines.join("\n");
}

export const INTERVIEW_PLAN_SYSTEM_PROMPT = `You are running a realistic mock job interview. You are given the interview panel (each interviewer tagged P1, P2, …, with whatever the candidate knows about them) and, optionally, the job description, the candidate's background, and points the candidate wants to land.

Plan the interview as 4 or 5 questions, in the order a real interview would ask them: a warm opener, then the substantive questions, then a closing question.

- Spread the questions across the panel. Each question is asked by one interviewer and must sound like that person: their role, their priorities, and anything the candidate knows about them should shape what they ask and how.
- If an interviewer has <questions_they_have_asked_before>, include at least one of those questions, verbatim or lightly adapted, asked by that interviewer.
- When a job description or candidate background is given, aim questions at them — name a specific project, skill, or gap where you can ("Walk me through the Acme migration — what did you own?").
- Don't ask about the key points directly; they are what the candidate hopes to work in, not a question list.

They will answer out loud, so each question asks exactly one thing: a single sentence ending in "?", under 30 words, no compound second half.

Reply with ONLY the plan, one question per line, in exactly this form:
P1: <question>
P2: <question>
...
No preamble, no numbering, no commentary.`;

export function buildInterviewPlanPrompt(prep: InterviewPrepState): string {
  return [buildInterviewContext(prep), "", "Plan the interview."].join("\n");
}
```

- [ ] **Step 4: Append to `lib/anthropic.ts`**

Extend the `./prompt` import list with `INTERVIEW_PLAN_SYSTEM_PROMPT, buildInterviewPlanPrompt,` and replace the `./types` import with:

```ts
import type {
  InterviewPanelist,
  InterviewPrepState,
  PlannedQuestion,
  QAExchange,
  Tone,
} from "./types";
```

Append before `function textOf(`:

```ts
// --- Interview prep (app/prep/interview) ------------------------------------

// "P2: …", tolerating a leading bullet/number and bold markers:
// "- **P1:** …", "2. P2 — …", "3) **P1** - …".
const PLAN_LINE =
  /^[ \t]*(?:[-*•]|\d+[.)])?[ \t]*\**[ \t]*P(\d+)[ \t]*\**[ \t]*[:.)\-–—][ \t]*\**[ \t]*(.+)$/i;

/** Parse the plan (see INTERVIEW_PLAN_SYSTEM_PROMPT) into tagged questions.
 *  Only tagged lines count. An out-of-range tag keeps an empty panelistId so
 *  verifyInterviewPlan rejects the plan instead of rendering "undefined asks". */
export function parseInterviewPlan(
  text: string,
  panel: InterviewPanelist[],
): PlannedQuestion[] {
  const out: PlannedQuestion[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(PLAN_LINE);
    if (!m) continue;
    const question = cleanQuestion(m[2].replace(/\*+/g, ""));
    if (!question) continue;
    out.push({ panelistId: panel[Number(m[1]) - 1]?.id ?? "", question });
  }
  return out;
}

export async function generateInterviewPlan(
  prep: InterviewPrepState,
): Promise<PlannedQuestion[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: INTERVIEW_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildInterviewPlanPrompt(prep) }],
  });
  return parseInterviewPlan(textOf(response), prep.panel);
}
```

- [ ] **Step 5: Append to `lib/verifyOutput.ts`**

Add at the top of the file (after the header comment):

```ts
import type { InterviewPanelist } from "./types";
```

Append at the end:

```ts
// --- Interview prep (app/prep/interview) ------------------------------------

/** 3-6 complete questions, each attributed to a panelist that exists. The
 *  prompt asks for 4-5; the range is slack, not the target. */
export function verifyInterviewPlan(
  questions: unknown,
  panel: InterviewPanelist[],
): QuestionsCheck {
  if (!Array.isArray(questions) || questions.length < 3) {
    return { ok: false, reason: "too-few" };
  }
  if (questions.length > 6) return { ok: false, reason: "too-many" };
  const ids = new Set(panel.map((p) => p.id));
  for (const q of questions) {
    if (!q || typeof q !== "object" || typeof q.question !== "string") {
      return { ok: false, reason: "malformed-item" };
    }
    if (!ids.has(q.panelistId)) return { ok: false, reason: "unknown-panelist" };
  }
  return verifyQuestions(questions.map((q) => q.question));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (Task 1 + Task 3 tests).

- [ ] **Step 7: Create `lib/claudeRoute.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logError } from "./logger";

// Shared responses for the interview-prep Claude routes. Same behavior as the
// inline blocks in the older routes (which are deliberately left as-is).

export function demoLimitResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Demo limit reached — please check back later.",
      code: "demo_limit_reached",
    },
    { status: 429 },
  );
}

export function anthropicErrorResponse(
  err: unknown,
  scope: string,
  rid: string,
): NextResponse {
  if (err instanceof Anthropic.AuthenticationError) {
    logError(scope, rid, "anthropic call failed: authentication");
    Sentry.captureException(err, { tags: { route: scope, rid } });
    return NextResponse.json(
      { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    logError(scope, rid, "anthropic call failed: rate limited");
    return NextResponse.json(
      { error: "Rate limited by the Claude API. Wait a moment and try again." },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    logError(scope, rid, `anthropic call failed: API error ${err.status ?? "?"}`);
    Sentry.captureException(err, {
      tags: { route: scope, rid, anthropicStatus: String(err.status ?? "") },
    });
    return NextResponse.json(
      { error: `Claude API error (${err.status ?? "unknown"}).` },
      { status: 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  logError(scope, rid, `unhandled error: ${message}`, err);
  Sentry.captureException(err, { tags: { route: scope, rid } });
  return NextResponse.json({ error: message }, { status: 500 });
}
```

- [ ] **Step 8: Create `app/api/interview-questions/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewPlan } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { hasPanelContent, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyInterviewPlan } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-questions";

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prep = normalizePrep(payload);
  if (!hasPanelContent(prep)) {
    return NextResponse.json(
      { error: "Tell us something about at least one interviewer first." },
      { status: 400 },
    );
  }

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { panelSize: prep.panel.length });
    const questions = await generateInterviewPlan(prep);
    logInfo(SCOPE, rid, "anthropic call succeeded", { questionCount: questions.length });

    const check = verifyInterviewPlan(questions, prep.panel);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, {
        count: questions.length,
      });
      Sentry.captureMessage("interview-questions verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
      });
      return NextResponse.json(
        {
          error: "The interview questions came back malformed. Please try again.",
          code: "interview_plan_malformed",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ questions });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
```

Note: the verification-failure log deliberately does NOT include a text preview (unlike `/grill`) — questions may quote interviewer details.

- [ ] **Step 9: Smoke-test the route** (costs one Claude call)

With `npm run dev` running:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"panel":[{"id":"a","name":"Priya Shah","title":"VP Engineering","about":"Ex-Stripe. Writes about scaling payments infra and on-call culture."},{"id":"b","title":"Recruiter"}],"candidate":{"jobDescription":"Staff backend engineer, payments"}}' \
  http://localhost:3000/api/interview-questions
```
Expected: `{"questions":[{"panelistId":"a","question":"…?"}, …]}` with 3–6 items, ids only `a`/`b`. Also: `curl … -d '{}'` → 400 "Tell us something about at least one interviewer first."

Run: `npx tsc --noEmit && npm test` → no errors, PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/prompt.ts lib/anthropic.ts lib/verifyOutput.ts lib/claudeRoute.ts app/api/interview-questions lib/*.interview.test.ts
git commit -m "Add interview question-plan prompt, parser, verifier, and route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Adaptive follow-up — prompt, parser, route

**Files:**
- Modify: `lib/prompt.ts` (append), `lib/anthropic.ts` (import + append), `lib/prompt.interview.test.ts`, `lib/anthropic.interview.test.ts`
- Create: `app/api/interview-followup/route.ts`

**Interfaces:**
- Consumes: `buildInterviewContext`, `panelTag` (Task 3); `normalizePrep`, `PREP_LIMITS` (Task 1); `verifyFollowUp` (existing, `lib/verifyOutput.ts`); `demoLimitResponse`, `anthropicErrorResponse` (Task 3).
- Produces:
  - `lib/prompt.ts`: `INTERVIEW_FOLLOWUP_SYSTEM_PROMPT`, `buildInterviewFollowUpPrompt(prep: InterviewPrepState, panelistId: string, question: string, transcript: string, upcomingQuestions: string[]): string`
  - `lib/anthropic.ts`: `parseFollowUp(text: string): string | null` (`null` = NONE; `""` = empty reply), `generateInterviewFollowUp(prep, panelistId, question, transcript, upcomingQuestions): Promise<string | null>`
  - `POST /api/interview-followup` body `InterviewFollowUpRequest` → `{ followUp: string | null }`

- [ ] **Step 1: Write the failing tests**

Append to `lib/anthropic.interview.test.ts` (and add `parseFollowUp` to its import from `./anthropic`):

```ts
describe("parseFollowUp", () => {
  it("treats NONE variants as no follow-up", () => {
    for (const t of ["NONE", "none.", '"NONE"', "**NONE**", "None — the answer was complete.", "  NONE\n"]) {
      expect(parseFollowUp(t)).toBeNull();
    }
  });
  it("does not mistake a real question starting with 'None' for NONE", () => {
    expect(parseFollowUp("None of those numbers were yours — what did you personally own?"))
      .toBe("None of those numbers were yours — what did you personally own?");
  });
  it("returns the cleaned question otherwise", () => {
    expect(parseFollowUp('"What broke first when traffic doubled?"\nextra line'))
      .toBe("What broke first when traffic doubled?");
  });
  it("returns an empty string for an empty reply", () => {
    expect(parseFollowUp("   ")).toBe("");
  });
});
```

Append to `lib/prompt.interview.test.ts` (and add `buildInterviewFollowUpPrompt` to its import from `./prompt`):

```ts
describe("buildInterviewFollowUpPrompt", () => {
  it("names the asking interviewer's tag and includes the answer and upcoming questions", () => {
    const text = buildInterviewFollowUpPrompt(prep(), "b", "Why leave?", "Growth, mostly.", ["What's your stack?"]);
    expect(text).toContain('<asked_by tag="P2" />');
    expect(text).toContain("<question>\nWhy leave?\n</question>");
    expect(text).toContain("Growth, mostly.");
    expect(text).toContain("- What's your stack?");
  });
  it("omits the upcoming block when there are none", () => {
    expect(buildInterviewFollowUpPrompt(prep(), "a", "Q?", "A", [])).not.toContain("<upcoming_questions>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `parseFollowUp` / `buildInterviewFollowUpPrompt` not exported.

- [ ] **Step 3: Append to `lib/prompt.ts`**

```ts
export const INTERVIEW_FOLLOWUP_SYSTEM_PROMPT = `You are one interviewer on a mock interview panel. You just asked the candidate a question and heard their spoken answer (captured by speech-to-text — ignore transcription noise). Decide whether a real interviewer in your seat would follow up.

Follow up when the answer left something concrete unresolved: a vague claim with no example, a result with no number or outcome, a decision with no reasoning, "we" where you need to know what they personally did, or the part of the question they sidestepped. Name the specific thing you're pressing on — never "can you elaborate" or "tell me more".

Don't follow up when the answer was complete and specific; move on instead. Don't ask anything the upcoming planned questions already cover.

Stay in character as the interviewer tagged in <asked_by>: their role and priorities shape what they'd press on.

If you follow up: ask exactly one thing — a single sentence ending in "?", under 30 words, no compound second half. Reply with ONLY the question, no quotes, no preamble.
If you don't: reply with exactly NONE.`;

export function buildInterviewFollowUpPrompt(
  prep: InterviewPrepState,
  panelistId: string,
  question: string,
  transcript: string,
  upcomingQuestions: string[],
): string {
  const lines = [
    buildInterviewContext(prep),
    "",
    `<asked_by tag="${panelTag(prep.panel, panelistId)}" />`,
    "<question>",
    question.trim(),
    "</question>",
    "",
    "<candidate_answer>",
    "(Spoken out loud and transcribed by speech-to-text — expect some transcription noise.)",
    transcript.trim(),
    "</candidate_answer>",
  ];
  if (upcomingQuestions.length) {
    lines.push(
      "",
      "<upcoming_questions>",
      upcomingQuestions.map((q) => `- ${q}`).join("\n"),
      "</upcoming_questions>",
    );
  }
  lines.push("", "Follow up, or reply NONE.");
  return lines.join("\n");
}
```

- [ ] **Step 4: Append to `lib/anthropic.ts`**

Add `INTERVIEW_FOLLOWUP_SYSTEM_PROMPT, buildInterviewFollowUpPrompt,` to the `./prompt` import, then append after `generateInterviewPlan`:

```ts
/** `null` = the model said NONE (answer was complete). `""` = empty reply
 *  (caller's verification treats it as malformed). A reply starting "None"
 *  that ends in "?" is a real question, not NONE. */
export function parseFollowUp(text: string): string | null {
  const q = cleanQuestion(text.trim().replace(/^\*+|\*+$/g, ""));
  if (!q) return "";
  if (/^\**none\b/i.test(q) && !q.endsWith("?")) return null;
  return q;
}

export async function generateInterviewFollowUp(
  prep: InterviewPrepState,
  panelistId: string,
  question: string,
  transcript: string,
  upcomingQuestions: string[],
): Promise<string | null> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 200,
    system: INTERVIEW_FOLLOWUP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildInterviewFollowUpPrompt(
          prep,
          panelistId,
          question,
          transcript,
          upcomingQuestions,
        ),
      },
    ],
  });
  return parseFollowUp(textOf(response));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Create `app/api/interview-followup/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewFollowUp } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { PREP_LIMITS, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyFollowUp } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-followup";
const MAX_UPCOMING = 10;

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
    panelistId?: unknown;
    question?: unknown;
    transcript?: unknown;
    upcomingQuestions?: unknown;
  };
  const prep = normalizePrep(payload);

  const panelistId = typeof body.panelistId === "string" ? body.panelistId : "";
  if (!prep.panel.some((p) => p.id === panelistId)) {
    return NextResponse.json({ error: "Unknown interviewer." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > PREP_LIMITS.question) {
    return NextResponse.json({ error: "Missing or over-long question." }, { status: 400 });
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your answer before continuing." },
      { status: 400 },
    );
  }
  if (transcript.length > PREP_LIMITS.transcript) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }
  const upcomingQuestions = Array.isArray(body.upcomingQuestions)
    ? body.upcomingQuestions
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, MAX_UPCOMING)
        .map((q) => q.trim().slice(0, PREP_LIMITS.question))
    : [];

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { transcriptChars: transcript.length });
    const followUp = await generateInterviewFollowUp(
      prep,
      panelistId,
      question,
      transcript,
      upcomingQuestions,
    );
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      followUp: followUp === null ? "none" : "question",
    });

    if (followUp !== null) {
      const check = verifyFollowUp(followUp);
      if (!check.ok) {
        // Never stall the round on a bad follow-up: log it and move on.
        logError(SCOPE, rid, `verification failed: ${check.reason} — skipping follow-up`);
        Sentry.captureMessage("interview-followup verification failed", {
          level: "warning",
          tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
        });
        return NextResponse.json({ followUp: null });
      }
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ followUp });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
```

- [ ] **Step 7: Smoke-test** (one Claude call)

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"panel":[{"id":"a","name":"Priya","title":"VP Engineering"}],"panelistId":"a","question":"Tell me about a system you scaled?","transcript":"We made it faster and it went well.","upcomingQuestions":[]}' \
  http://localhost:3000/api/interview-followup
```
Expected: `{"followUp":"…?"}` (vague answer → a follow-up). With `"panelistId":"zzz"` → 400 "Unknown interviewer."

Run: `npx tsc --noEmit && npm test` → clean.

- [ ] **Step 8: Commit**

```bash
git add lib/prompt.ts lib/anthropic.ts lib/*.interview.test.ts app/api/interview-followup
git commit -m "Add adaptive interview follow-up (NONE or one question)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Feedback — prompt, verifier, route

**Files:**
- Modify: `lib/prompt.ts`, `lib/anthropic.ts`, `lib/verifyOutput.ts`, `lib/prompt.interview.test.ts`, `lib/verifyOutput.interview.test.ts`
- Create: `app/api/interview-feedback/route.ts`

**Interfaces:**
- Consumes: `buildInterviewContext`, `panelTag` (Task 3); `normalizePrep`, `normalizeExchanges` (Task 1); `FeedbackCheck` (existing type in `lib/verifyOutput.ts`); route helpers (Task 3).
- Produces:
  - `lib/prompt.ts`: `INTERVIEW_FEEDBACK_SYSTEM_PROMPT`, `buildInterviewFeedbackPrompt(prep: InterviewPrepState, exchanges: InterviewExchange[]): string`
  - `lib/anthropic.ts`: `generateInterviewFeedback(prep, exchanges): Promise<string>`
  - `lib/verifyOutput.ts`: `verifyInterviewFeedback(text: unknown, hasKeyPoints: boolean): FeedbackCheck`
  - `POST /api/interview-feedback` body `InterviewFeedbackRequest` → `{ feedback: string }`

- [ ] **Step 1: Write the failing tests**

Append to `lib/prompt.interview.test.ts` (add `buildInterviewFeedbackPrompt` to the import):

```ts
describe("buildInterviewFeedbackPrompt", () => {
  it("numbers exchanges, tags the asker, and includes answered follow-ups", () => {
    const text = buildInterviewFeedbackPrompt(prep(), [
      { panelistId: "a", question: "Q1?", transcript: "A1", followUp: "F1?", followUpTranscript: "FA1" },
      { panelistId: "b", question: "Q2?", transcript: "A2" },
    ]);
    expect(text).toContain('<exchange number="1" asked_by="P1">');
    expect(text).toContain('<exchange number="2" asked_by="P2">');
    expect(text).toContain("<follow_up>\nF1?\n</follow_up>");
    expect(text).toContain("FA1");
  });
  it("never includes a follow-up that has no answer", () => {
    const text = buildInterviewFeedbackPrompt(prep(), [
      { panelistId: "a", question: "Q1?", transcript: "A1", followUp: "F1?" },
    ]);
    expect(text).not.toContain("F1?");
    expect(text).not.toContain("<follow_up>");
  });
});
```

Append to `lib/verifyOutput.interview.test.ts` (add `verifyInterviewFeedback` to the import):

```ts
const FULL = [
  "**Overall** — Solid.",
  "**Question by question**",
  "### Why this role?",
  "- Good hook.",
  "**Key points** — You landed the migration.",
  "**Reading the panel** — Priya wanted numbers.",
  "**For your next round**",
  "- Lead with the result.",
].join("\n");

describe("verifyInterviewFeedback", () => {
  it("accepts all sections", () => {
    expect(verifyInterviewFeedback(FULL, true).ok).toBe(true);
  });
  it("requires Key points only when key points were given", () => {
    const noKp = FULL.replace("**Key points** — You landed the migration.\n", "");
    expect(verifyInterviewFeedback(noKp, false).ok).toBe(true);
    expect(verifyInterviewFeedback(noKp, true)).toMatchObject({ ok: false, missing: ["Key points"] });
  });
  it("reports missing required sections", () => {
    const r = verifyInterviewFeedback(FULL.replace("**Reading the panel** — Priya wanted numbers.", ""), false);
    expect(r).toMatchObject({ ok: false, missing: ["Reading the panel"] });
  });
  it("rejects empty or tiny output", () => {
    expect(verifyInterviewFeedback("", false)).toMatchObject({ ok: false, reason: "empty-or-too-short" });
    expect(verifyInterviewFeedback(null, false).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `buildInterviewFeedbackPrompt` / `verifyInterviewFeedback` not exported.

- [ ] **Step 3: Append to `lib/prompt.ts`**

```ts
export const INTERVIEW_FEEDBACK_SYSTEM_PROMPT = `You are an interview coach reviewing a mock interview. The candidate answered each question out loud (captured by speech-to-text — ignore transcription noise and never comment on it). Some questions got one follow-up from the same interviewer.

You are given the panel (tagged P1, P2, …, with what the candidate knows about each person), optionally the job description, the candidate's background, and key points they wanted to land, then the exchanges.

Give focused, encouraging, specific feedback they can act on before the real interview. Quote short phrases from their answers where it helps. When their background contains a stronger or more relevant example than the one they used, name it.

Format the response in Markdown with these sections, in this order, using exactly these bold headings:
- **Overall** — two or three sentences on how the interview went.
- **Question by question** — for each exchange, a "### " subheading with the question (shortened if long), then 2 to 3 bullets: what worked, what was missing (a result, a number, their personal role, a direct answer), and how the follow-up went if there was one.
- **Key points** — ONLY if <key_points_to_land> is present: for each key point, whether it landed, where, or that it never came up. Omit this section entirely otherwise.
- **Reading the panel** — 2 to 3 bullets on how well the answers matched what each interviewer appears to care about, by name or title.
- **For your next round** — 2 to 3 concrete, prioritized changes.

Be direct but supportive. No preamble before the feedback.`;

export function buildInterviewFeedbackPrompt(
  prep: InterviewPrepState,
  exchanges: InterviewExchange[],
): string {
  const lines = [buildInterviewContext(prep), ""];
  exchanges.forEach((ex, i) => {
    lines.push(
      `<exchange number="${i + 1}" asked_by="${panelTag(prep.panel, ex.panelistId)}">`,
      "<question>",
      ex.question.trim(),
      "</question>",
      "<answer>",
      ex.transcript.trim(),
      "</answer>",
    );
    // A follow-up shown but never answered (ended early) is left out entirely.
    if (ex.followUp?.trim() && ex.followUpTranscript?.trim()) {
      lines.push(
        "<follow_up>",
        ex.followUp.trim(),
        "</follow_up>",
        "<follow_up_answer>",
        ex.followUpTranscript.trim(),
        "</follow_up_answer>",
      );
    }
    lines.push("</exchange>", "");
  });
  lines.push("Give the feedback.");
  return lines.join("\n");
}
```

- [ ] **Step 4: Append to `lib/anthropic.ts`**

Add `INTERVIEW_FEEDBACK_SYSTEM_PROMPT, buildInterviewFeedbackPrompt,` to the `./prompt` import and `InterviewExchange,` to the `./types` import. Append after `generateInterviewFollowUp`:

```ts
export async function generateInterviewFeedback(
  prep: InterviewPrepState,
  exchanges: InterviewExchange[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: INTERVIEW_FEEDBACK_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildInterviewFeedbackPrompt(prep, exchanges) },
    ],
  });
  return textOf(response);
}
```

- [ ] **Step 5: Append to `lib/verifyOutput.ts`**

```ts
const INTERVIEW_FEEDBACK_SECTIONS: { label: string; re: RegExp; keyPointsOnly?: boolean }[] = [
  { label: "Overall", body: String.raw`overall\b` },
  { label: "Question by question", body: String.raw`question[\s-]+by[\s-]+question\b` },
  { label: "Key points", body: String.raw`key\s+points\b`, keyPointsOnly: true },
  { label: "Reading the panel", body: String.raw`reading\s+the\s+panel\b` },
  { label: "For your next round", body: String.raw`(?:for\s+your\s+)?next\s+round\b` },
].map(({ label, body, keyPointsOnly }) => ({
  label,
  re: new RegExp(HEAD + body, "i"),
  keyPointsOnly,
}));

/** Required interview-feedback sections; "Key points" only when the candidate
 *  gave key points (the prompt tells Claude to omit it otherwise). */
export function verifyInterviewFeedback(
  text: unknown,
  hasKeyPoints: boolean,
): FeedbackCheck {
  const required = INTERVIEW_FEEDBACK_SECTIONS.filter(
    (s) => hasKeyPoints || !s.keyPointsOnly,
  );
  if (typeof text !== "string" || text.trim().length < 60) {
    return {
      ok: false,
      missing: required.map((s) => s.label),
      reason: "empty-or-too-short",
    };
  }
  const missing = required.filter((s) => !s.re.test(text)).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Create `app/api/interview-feedback/route.ts`**

```ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewFeedback } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { normalizeExchanges, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyInterviewFeedback } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-feedback";

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prep = normalizePrep(payload);
  const exchanges = normalizeExchanges((payload as { exchanges?: unknown })?.exchanges);
  if (exchanges.length === 0) {
    return NextResponse.json(
      { error: "Answer at least one question before asking for feedback." },
      { status: 400 },
    );
  }
  const hasKeyPoints = prep.candidate.keyPoints.length > 0;

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", {
      exchanges: exchanges.length,
      hasKeyPoints,
    });
    const feedback = await generateInterviewFeedback(prep, exchanges);
    logInfo(SCOPE, rid, "anthropic call succeeded", { chars: feedback.length });

    const check = verifyInterviewFeedback(feedback, hasKeyPoints);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: missing ${check.missing.join(", ")}`);
      Sentry.captureMessage("interview-feedback verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "missing-sections" },
        extra: { missing: check.missing },
      });
      return NextResponse.json(
        {
          error: "The feedback came back incomplete. Please try again.",
          code: "feedback_incomplete",
        },
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

- [ ] **Step 8: Smoke-test** (one Claude call)

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"panel":[{"id":"a","name":"Priya","title":"VP Engineering"}],"candidate":{"keyPoints":["I led the payments migration"]},"exchanges":[{"panelistId":"a","question":"Tell me about a system you scaled?","transcript":"At Acme I led the payments migration, we went from 2k to 20k TPS.","followUp":"What broke first?","followUpTranscript":"The ledger writes, so we sharded by merchant."}]}' \
  http://localhost:3000/api/interview-feedback
```
Expected: `{"feedback":"**Overall** …"}` containing all 5 headings. With `"exchanges":[]` → 400.

Run: `npx tsc --noEmit && npm test` → clean.

- [ ] **Step 9: Commit**

```bash
git add lib/prompt.ts lib/anthropic.ts lib/verifyOutput.ts lib/*.interview.test.ts app/api/interview-feedback
git commit -m "Add interview feedback prompt, verifier, and route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Interview UI — setup, round, feedback, session, page

**Files:**
- Create: `lib/clientFetch.ts`, `components/PanelSetup.tsx`, `components/InterviewRound.tsx`, `components/InterviewFeedbackSections.tsx`, `components/InterviewSession.tsx`, `app/prep/interview/page.tsx`
- Modify: `lib/analytics.ts` (`EVENTS`)

**Interfaces:**
- Consumes: everything from Tasks 1–5; `PracticeRecorder`, `speechRecognitionSupported` (`components/PracticeRecorder.tsx`); `extractScriptText`, `ACCEPTED_UPLOAD` (`lib/scriptImport.ts`); `newId` (`lib/practiceStore.ts`); `reportClientError` (`lib/clientErrors.ts`); `track`, `EVENTS` (`lib/analytics.ts`); `FeedbackWidget`; `components/ui`.
- Produces:
  - `lib/clientFetch.ts`: `DEMO_LIMIT_MESSAGE`, `interface FetchError extends Error { demoLimited?: boolean }`, `postJSON<T>(url: string, body: unknown): Promise<T>`
  - `EVENTS.interviewSetupSaved`, `EVENTS.interviewRoundStarted`, `EVENTS.interviewRoundCompleted`, `EVENTS.interviewFeedbackReceived`
  - Page `/prep/interview`

No unit tests (UI); verified manually in Step 8.

- [ ] **Step 1: Add analytics events**

In `lib/analytics.ts`, add inside `EVENTS` after `expertRequestSubmitted`:

```ts
  expertRequestSubmitted: "expert_request_submitted",
  interviewSetupSaved: "interview_setup_saved",
  interviewRoundStarted: "interview_round_started",
  interviewRoundCompleted: "interview_round_completed",
  interviewFeedbackReceived: "interview_feedback_received",
```

- [ ] **Step 2: Create `lib/clientFetch.ts`**

```ts
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
```

- [ ] **Step 3: Create `components/PanelSetup.tsx`**

```tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import { reportClientError } from "@/lib/clientErrors";
import { newId } from "@/lib/practiceStore";
import { PREP_LIMITS, emptyPanelist } from "@/lib/interviewPrep";
import type { InterviewPanelist, InterviewPrepState } from "@/lib/types";
import { Button, Callout, Card, Field, IconButton, Input, Textarea } from "@/components/ui";

// Controlled setup form for /prep/interview. Saving is the parent's job
// (InterviewSession debounces PUT /api/interview-prep on every change).

interface Props {
  value: InterviewPrepState;
  onChange: (next: InterviewPrepState) => void;
}

/** "or [Upload a file] .txt, .md, or .pdf" — fills a textarea from a file. */
function UploadInto({
  onText,
  area,
}: {
  onText: (text: string, note: string) => void;
  area: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      onText(
        text,
        `Imported “${file.name}”${truncated ? " — trimmed to the first 8,000 characters" : ""}.`,
      );
    } catch (err) {
      reportClientError(err, { area });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-text-muted">or</span>
        <Button
          variant="secondary"
          size="sm"
          icon="upload"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Reading…" : "Upload a file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_UPLOAD}
          onChange={handle}
          className="hidden"
        />
        <span className="text-caption text-text-muted">.txt, .md, or .pdf</span>
      </div>
      {error && <Callout tone="critical">{error}</Callout>}
    </div>
  );
}

function PanelistCard({
  p,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  p: InterviewPanelist;
  index: number;
  canRemove: boolean;
  onChange: (next: InterviewPanelist) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const set = (field: keyof InterviewPanelist) => (v: string) =>
    onChange({ ...p, [field]: v });
  const idp = `panelist-${p.id}`;

  return (
    <Card tone="sunken" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h4 text-text-primary">Interviewer {index + 1}</h3>
        {canRemove && (
          <IconButton icon="x" label={`Remove interviewer ${index + 1}`} onClick={onRemove} />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor={`${idp}-name`}>
          <Input
            id={`${idp}-name`}
            value={p.name}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Priya Shah"
          />
        </Field>
        <Field label="Title" htmlFor={`${idp}-title`}>
          <Input
            id={`${idp}-title`}
            value={p.title}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="VP Engineering"
          />
        </Field>
        <Field label="Company" htmlFor={`${idp}-company`}>
          <Input
            id={`${idp}-company`}
            value={p.company}
            maxLength={PREP_LIMITS.short}
            onChange={(e) => set("company")(e.target.value)}
            placeholder="Acme"
          />
        </Field>
      </div>
      <Field
        label="What do you know about them?"
        htmlFor={`${idp}-about`}
        hint="Anything helps: their LinkedIn profile (paste the text, or upload LinkedIn's “Save to PDF”), things they've written, where they've worked, what they care about."
      >
        <Textarea
          id={`${idp}-about`}
          value={p.about}
          rows={6}
          maxLength={PREP_LIMITS.about}
          onChange={(e) => set("about")(e.target.value)}
        />
        <UploadInto
          area="interview:upload-about"
          onText={(text, n) => {
            set("about")(text);
            setNote(n);
          }}
        />
        {note && <Callout tone="info">{note}</Callout>}
      </Field>
      <Field
        label="Questions they've asked before"
        htmlFor={`${idp}-past`}
        hint="From Glassdoor, a recruiter, or a friend who interviewed there. Optional."
      >
        <Textarea
          id={`${idp}-past`}
          value={p.pastQuestions}
          rows={3}
          maxLength={PREP_LIMITS.pastQuestions}
          onChange={(e) => set("pastQuestions")(e.target.value)}
        />
      </Field>
    </Card>
  );
}

export default function PanelSetup({ value, onChange }: Props) {
  const [showYourSide, setShowYourSide] = useState(
    Boolean(
      value.candidate.jobDescription ||
        value.candidate.background ||
        value.candidate.keyPoints.length,
    ),
  );
  const { panel, candidate } = value;
  // Always show one empty key-point input below the filled ones (up to 5).
  const keyPointInputs =
    candidate.keyPoints.length < PREP_LIMITS.keyPointsMax
      ? [...candidate.keyPoints, ""]
      : candidate.keyPoints;

  const setPanel = (next: InterviewPanelist[]) => onChange({ ...value, panel: next });
  const setCandidate = (patch: Partial<InterviewPrepState["candidate"]>) =>
    onChange({ ...value, candidate: { ...candidate, ...patch } });

  function setKeyPoint(i: number, text: string) {
    const next = [...keyPointInputs];
    next[i] = text;
    // Blank entries are dropped; the trailing empty input is re-added on render.
    setCandidate({ keyPoints: next.filter((k) => k.trim() !== "") });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-h4 text-text-primary">Your panel</h2>
          <p className="mt-1 text-body-sm text-text-muted">
            Who&apos;s across the table? Add up to {PREP_LIMITS.panelMax} people.
          </p>
        </div>
        {panel.map((p, i) => (
          <PanelistCard
            key={p.id}
            p={p}
            index={i}
            canRemove={panel.length > 1}
            onChange={(next) => setPanel(panel.map((x) => (x.id === p.id ? next : x)))}
            onRemove={() => setPanel(panel.filter((x) => x.id !== p.id))}
          />
        ))}
        {panel.length < PREP_LIMITS.panelMax && (
          <Button
            variant="secondary"
            onClick={() => setPanel([...panel, emptyPanelist(newId())])}
          >
            Add interviewer
          </Button>
        )}
      </section>

      <section className="space-y-4">
        <Button
          variant="ghost"
          iconAfter={showYourSide ? "chevron-down" : "chevron-right"}
          onClick={() => setShowYourSide((s) => !s)}
        >
          Your side (optional)
        </Button>
        {showYourSide && (
          <Card tone="sunken" className="space-y-4">
            <Field
              label="Job description"
              htmlFor="jd"
              hint="Paste the posting — questions will target what it asks for."
            >
              <Textarea
                id="jd"
                value={candidate.jobDescription}
                rows={5}
                maxLength={PREP_LIMITS.jobDescription}
                onChange={(e) => setCandidate({ jobDescription: e.target.value })}
              />
              <UploadInto
                area="interview:upload-jd"
                onText={(text) => setCandidate({ jobDescription: text })}
              />
            </Field>
            <Field
              label="Your resume or background"
              htmlFor="background"
              hint="Feedback can point out a stronger example you didn't use."
            >
              <Textarea
                id="background"
                value={candidate.background}
                rows={5}
                maxLength={PREP_LIMITS.background}
                onChange={(e) => setCandidate({ background: e.target.value })}
              />
              <UploadInto
                area="interview:upload-background"
                onText={(text) => setCandidate({ background: text })}
              />
            </Field>
            <Field
              label="Key points you want to land"
              hint={`Up to ${PREP_LIMITS.keyPointsMax}. Feedback checks whether they came through.`}
            >
              <div className="space-y-2">
                {keyPointInputs.map((k, i) => (
                  <Input
                    key={i}
                    value={k}
                    maxLength={PREP_LIMITS.keyPoint}
                    onChange={(e) => setKeyPoint(i, e.target.value)}
                    placeholder={i === 0 ? "I led the payments migration end to end" : ""}
                    aria-label={`Key point ${i + 1}`}
                  />
                ))}
              </div>
            </Field>
          </Card>
        )}
      </section>
    </div>
  );
}
```

Behavior note: clearing a middle key point removes it (the inputs below shift up) — intended. A leading space typed into the trailing blank input is dropped until a non-space character follows — acceptable.

- [ ] **Step 4: Create `components/InterviewRound.tsx`**

```tsx
"use client";

import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import { PREP_LIMITS } from "@/lib/interviewPrep";
import { Badge, Button, Card, Textarea } from "@/components/ui";

interface Props {
  askedBy: string;
  question: string;
  isFollowUp: boolean;
  /** 1-based planned-question number and total. */
  number: number;
  total: number;
  transcript: string;
  onTranscript: (t: string) => void;
  onSubmit: () => void;
  canEndEarly: boolean;
  onEndEarly: () => void;
}

export default function InterviewRound({
  askedBy,
  question,
  isFollowUp,
  number,
  total,
  transcript,
  onTranscript,
  onSubmit,
  canEndEarly,
  onEndEarly,
}: Props) {
  const speechSupported = speechRecognitionSupported();

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-text-muted">
          Question {number} of {total}
        </span>
        {isFollowUp && <Badge tone="accent">Follow-up</Badge>}
      </div>
      <div>
        <p className="text-body-sm text-text-muted">{askedBy} asks:</p>
        <p className="mt-1 font-serif text-h3 text-text-primary">{question}</p>
      </div>

      <PracticeRecorder
        key={`${number}-${isFollowUp ? "f" : "q"}`}
        script={question}
        contentLabel={isFollowUp ? "Follow-up question" : "Question"}
        onComplete={({ transcript: t }) => onTranscript(t)}
      />

      <div>
        <label
          htmlFor="interview-transcript"
          className="block text-body-sm font-medium text-text-primary"
        >
          What you said
          {!speechSupported && (
            <span className="ml-2 font-normal text-text-muted">
              (speech-to-text unavailable in this browser — type it here)
            </span>
          )}
        </label>
        <Textarea
          id="interview-transcript"
          value={transcript}
          onChange={(e) => onTranscript(e.target.value)}
          rows={6}
          maxLength={PREP_LIMITS.transcript}
          placeholder="Your recorded words appear here. Edit as needed before continuing."
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit} disabled={!transcript.trim()} iconAfter="arrow-right">
          Continue
        </Button>
        {canEndEarly && (
          <Button variant="ghost" onClick={onEndEarly}>
            End early → get feedback
          </Button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Create `components/InterviewFeedbackSections.tsx`**

```tsx
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

// Renderer for interview feedback (INTERVIEW_FEEDBACK_SYSTEM_PROMPT). A
// standalone copy of QAFeedbackSections' approach, not a shared component —
// different section set, and "### question" subheadings inside "Question by
// question". Section names are anchored (^) so a question subheading that
// happens to contain "next round" or "overall" is never mistaken for a section.
const SECTIONS: { test: RegExp; title: string; icon: string; emphasis?: boolean }[] = [
  { test: /^overall\b/i, title: "Overall", icon: "message-square" },
  { test: /^question[\s-]+by[\s-]+question\b/i, title: "Question by question", icon: "layout-list" },
  { test: /^key\s+points\b/i, title: "Key points", icon: "check" },
  { test: /^reading\s+the\s+panel\b/i, title: "Reading the panel", icon: "search" },
  { test: /^(?:for\s+your\s+)?next\s+round\b/i, title: "For your next round", icon: "arrow-right", emphasis: true },
];

interface ParsedSection {
  title: string;
  icon: string;
  emphasis: boolean;
  lines: string[];
}

// Section headers: bold ("**Overall** — …") or level-1/2 ATX ("## Overall").
// Level-3+ ("### …") are question subheadings, handled in renderBody.
const BOLD_HEADER_RE = /^\s*(?:[-*]\s+)?\*\*(.+?)\*\*\s*(?:[:：]|[—–-])?\s*(.*)$/;
const HASH_HEADER_RE = /^\s*#{1,2}\s+\**(.+?)\**\s*:?\s*$/;
const SUBHEAD_RE = /^\s*#{3,6}\s+\**(.+?)\**\s*$/;

function parse(md: string): ParsedSection[] {
  const out: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const hash = line.match(HASH_HEADER_RE);
    const bold = hash ? null : line.match(BOLD_HEADER_RE);
    const name = hash ? hash[1] : bold ? bold[1] : null;
    const meta = name ? SECTIONS.find((s) => s.test.test(name.trim())) : undefined;
    if (name && meta) {
      if (current) out.push(current);
      current = { title: meta.title, icon: meta.icon, emphasis: Boolean(meta.emphasis), lines: [] };
      const rest = bold?.[2]?.trim();
      if (rest) current.lines.push(rest);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) out.push(current);
  return out;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      return bold ? (
        <strong key={i} className="font-semibold text-text-primary">
          {bold[1]}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      );
    });
}

function renderBody(lines: string[]): ReactNode[] {
  const blocks: ReactNode[] = [];
  let items: string[] | null = null;
  const flush = () => {
    if (!items) return;
    blocks.push(
      <ul
        key={blocks.length}
        className="list-disc space-y-1 pl-5 text-body-sm leading-relaxed text-text-body marker:text-text-muted"
      >
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    items = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const sub = line.match(SUBHEAD_RE);
    if (sub) {
      flush();
      blocks.push(
        <p key={blocks.length} className="pt-2 text-body-sm font-semibold text-text-primary">
          {sub[1]}
        </p>,
      );
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      items ??= [];
      items.push(bullet[1]);
    } else {
      flush();
      blocks.push(
        <p key={blocks.length} className="text-body-sm leading-relaxed text-text-body">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flush();
  return blocks;
}

export default function InterviewFeedbackSections({ feedback }: { feedback: string }) {
  const sections = parse(feedback);
  if (sections.length < 2) {
    return (
      <div className="whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
        {feedback}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div
          key={i}
          className={`border-l-2 border-ember pl-4 ${
            section.emphasis ? "rounded-r-md bg-surface-accent-tint py-3 pr-4" : ""
          }`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-accent">
            <Icon name={section.icon} size={13} />
            {section.title}
          </div>
          <div className="space-y-2">{renderBody(section.lines)}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `components/InterviewSession.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import PanelSetup from "./PanelSetup";
import InterviewRound from "./InterviewRound";
import InterviewFeedbackSections from "./InterviewFeedbackSections";
import FeedbackWidget from "./FeedbackWidget";
import { DEMO_LIMIT_MESSAGE, postJSON, type FetchError } from "@/lib/clientFetch";
import { loadInterviewPrep, saveInterviewPrep } from "@/lib/interviewPrepStore";
import { emptyPrep, hasPanelContent, panelistLabel } from "@/lib/interviewPrep";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import type {
  InterviewExchange,
  InterviewFeedbackResponse,
  InterviewFollowUpResponse,
  InterviewPrepState,
  InterviewQuestionsResponse,
  PlannedQuestion,
} from "@/lib/types";
import { Button, Callout, Card } from "@/components/ui";

// /prep/interview: setup (persisted panel) -> planning -> round (each planned
// question, at most one adaptive follow-up) -> feedback. Rounds are NOT
// persisted in v0: a refresh returns to setup with the panel intact.

type Stage =
  | "loading"
  | "setup"
  | "planning"
  | "round"
  | "followup-loading"
  | "feedback-loading"
  | "feedback";

const SAVE_DEBOUNCE_MS = 800;

export default function InterviewSession() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prep, setPrep] = useState<InterviewPrepState>(emptyPrep);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);

  const [plan, setPlan] = useState<PlannedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [onFollowUp, setOnFollowUp] = useState(false);
  const [exchanges, setExchanges] = useState<InterviewExchange[]>([]);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const startedAt = useRef(0);
  const completedTracked = useRef(false);
  // JSON of the last state known to be on the server — auto-save only fires
  // when the form actually differs from it (so hydration and stage changes
  // never trigger a redundant PUT, and the first real edit always saves).
  const lastSaved = useRef("");

  // Hydrate the saved panel once.
  useEffect(() => {
    loadInterviewPrep()
      .then((p) => {
        lastSaved.current = JSON.stringify(p);
        setPrep(p);
      })
      .catch((err) => {
        reportClientError(err, { area: "interview:load" });
        lastSaved.current = JSON.stringify(emptyPrep());
        setSaveWarning("Couldn't load your saved panel — starting fresh.");
      })
      .finally(() => setStage("setup"));
  }, []);

  function persist(state: InterviewPrepState) {
    const snapshot = JSON.stringify(state);
    return saveInterviewPrep(state)
      .then(() => {
        lastSaved.current = snapshot;
        setSaveWarning(null);
      })
      .catch((err) => {
        reportClientError(err, { area: "interview:save" });
        setSaveWarning(
          "Couldn't save your panel. You can still practice; changes may not be there next time.",
        );
      });
  }

  // Debounced auto-save while editing.
  useEffect(() => {
    if (stage !== "setup" || JSON.stringify(prep) === lastSaved.current) return;
    const t = setTimeout(() => void persist(prep), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, stage]);

  function fail(err: unknown, area: string, revertTo: Stage) {
    if ((err as FetchError)?.demoLimited) setDemoLimited(true);
    else {
      reportClientError(err, { area });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStage(revertTo);
  }

  async function startRound() {
    setError(null);
    setDemoLimited(false);
    setStage("planning");
    if (JSON.stringify(prep) !== lastSaved.current) void persist(prep);
    track(EVENTS.interviewSetupSaved, {
      panel_size: prep.panel.length,
      has_jd: Boolean(prep.candidate.jobDescription.trim()),
      has_background: Boolean(prep.candidate.background.trim()),
      key_points_count: prep.candidate.keyPoints.length,
    });
    try {
      const data = await postJSON<InterviewQuestionsResponse>("/api/interview-questions", prep);
      setPlan(data.questions);
      setIndex(0);
      setOnFollowUp(false);
      setExchanges([]);
      setTranscript("");
      setFeedback(null);
      startedAt.current = Date.now();
      completedTracked.current = false;
      track(EVENTS.interviewRoundStarted, {
        panel_size: prep.panel.length,
        question_count: data.questions.length,
      });
      setStage("round");
    } catch (err) {
      fail(err, "interview:questions", "setup");
    }
  }

  function advance(ex: InterviewExchange[]) {
    if (index + 1 < plan.length) {
      setIndex(index + 1);
      setOnFollowUp(false);
      setTranscript("");
      setStage("round");
    } else {
      void getFeedback(ex);
    }
  }

  async function submitAnswer() {
    const answer = transcript.trim();
    if (!answer) return;
    setError(null);

    if (onFollowUp) {
      const ex = exchanges.map((e, i) =>
        i === exchanges.length - 1 ? { ...e, followUpTranscript: answer } : e,
      );
      setExchanges(ex);
      advance(ex);
      return;
    }

    const planned = plan[index];
    const ex = [...exchanges, { panelistId: planned.panelistId, question: planned.question, transcript: answer }];
    setExchanges(ex);
    setStage("followup-loading");
    try {
      const data = await postJSON<InterviewFollowUpResponse>("/api/interview-followup", {
        ...prep,
        panelistId: planned.panelistId,
        question: planned.question,
        transcript: answer,
        upcomingQuestions: plan.slice(index + 1).map((q) => q.question),
      });
      if (data.followUp) {
        const withFollowUp = ex.map((e, i) =>
          i === ex.length - 1 ? { ...e, followUp: data.followUp ?? undefined } : e,
        );
        setExchanges(withFollowUp);
        setOnFollowUp(true);
        setTranscript("");
        setStage("round");
        return;
      }
      advance(ex);
    } catch (err) {
      // A follow-up is optional — any failure just moves on to the next
      // question (the answer is already recorded in `ex`, so staying put
      // would let a second Continue record it twice).
      if ((err as FetchError)?.demoLimited) setDemoLimited(true);
      else reportClientError(err, { area: "interview:followup" });
      advance(ex);
    }
  }

  async function getFeedback(ex: InterviewExchange[]) {
    if (ex.length === 0) return;
    setError(null);
    setDemoLimited(false);
    setStage("feedback-loading");
    if (!completedTracked.current) {
      completedTracked.current = true;
      track(EVENTS.interviewRoundCompleted, {
        answered: ex.length,
        followups: ex.filter((e) => e.followUpTranscript).length,
        ended_early: ex.length < plan.length,
        duration_sec: Math.round((Date.now() - startedAt.current) / 1000),
      });
    }
    try {
      const data = await postJSON<InterviewFeedbackResponse>("/api/interview-feedback", {
        ...prep,
        exchanges: ex,
      });
      setFeedback(data.feedback);
      track(EVENTS.interviewFeedbackReceived);
      setStage("feedback");
    } catch (err) {
      setFeedback(null);
      fail(err, "interview:feedback", "feedback");
    }
  }

  function editPanel() {
    setError(null);
    setDemoLimited(false);
    setStage("setup");
  }

  const notices = (
    <>
      {demoLimited && <Callout tone="caution">{DEMO_LIMIT_MESSAGE}</Callout>}
      {error && !demoLimited && <Callout tone="critical">{error}</Callout>}
    </>
  );

  if (stage === "loading") {
    return (
      <Card>
        <p className="text-body-sm text-text-muted">Loading your panel…</p>
      </Card>
    );
  }

  if (stage === "setup") {
    return (
      <div className="space-y-6">
        {saveWarning && <Callout tone="caution">{saveWarning}</Callout>}
        <PanelSetup value={prep} onChange={setPrep} />
        {notices}
        <Button onClick={startRound} disabled={!hasPanelContent(prep)} iconAfter="arrow-right">
          Start mock interview
        </Button>
        {!hasPanelContent(prep) && (
          <p className="text-caption text-text-muted">
            Add something about at least one interviewer to start.
          </p>
        )}
      </div>
    );
  }

  if (stage === "planning" || stage === "followup-loading" || stage === "feedback-loading") {
    return (
      <Card>
        <p className="text-body-sm text-text-muted">
          {stage === "planning" && "Reading up on your panel and planning the interview…"}
          {stage === "followup-loading" && "Thinking…"}
          {stage === "feedback-loading" && "Putting together your feedback…"}
        </p>
      </Card>
    );
  }

  if (stage === "round") {
    const planned = plan[index];
    const question = onFollowUp ? exchanges[exchanges.length - 1]?.followUp ?? "" : planned.question;
    const pIndex = prep.panel.findIndex((p) => p.id === planned.panelistId);
    const askedBy = pIndex === -1 ? "The interviewer" : panelistLabel(prep.panel[pIndex], pIndex);
    return (
      <div className="space-y-4">
        <InterviewRound
          askedBy={askedBy}
          question={question}
          isFollowUp={onFollowUp}
          number={index + 1}
          total={plan.length}
          transcript={transcript}
          onTranscript={setTranscript}
          onSubmit={submitAnswer}
          canEndEarly={exchanges.length > 0}
          onEndEarly={() => void getFeedback(exchanges)}
        />
        {notices}
      </div>
    );
  }

  // stage === "feedback"
  return (
    <div className="space-y-6">
      {feedback ? (
        <Card padding="lg">
          <h2 className="mb-5 text-h4 text-text-primary">How it went</h2>
          <InterviewFeedbackSections feedback={feedback} />
        </Card>
      ) : (
        <Card className="space-y-4">
          {notices}
          <Button onClick={() => void getFeedback(exchanges)} icon="rotate-ccw">
            Try the feedback again
          </Button>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={startRound}>Run another round</Button>
        <Button variant="secondary" onClick={editPanel}>
          Edit panel
        </Button>
      </div>
      {feedback && (
        <FeedbackWidget
          surveyKey="interview_feedback_rating"
          surveyName="Interview feedback"
          question="How useful was this mock interview?"
        />
      )}
    </div>
  );
}
```

Note on `track(EVENTS.interviewFeedbackReceived)`: `track`'s `props` is optional, so no second argument is needed.

- [ ] **Step 7: Create `app/prep/interview/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import InterviewSession from "@/components/InterviewSession";

export const metadata: Metadata = {
  title: "Interview practice · VocalGym",
  description:
    "Describe who's interviewing you, then rehearse a mock interview out loud and get feedback.",
};

export default function InterviewPrepPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">Mock interview</h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            Tell us who you&apos;re meeting. We&apos;ll run a short interview in
            their voice: answer out loud, handle follow-ups, and see how it
            landed.
          </p>
        </div>
        <Link
          href="/prep"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Back
        </Link>
      </header>
      <InterviewSession />
    </main>
  );
}
```

- [ ] **Step 8: Type-check and verify in the browser**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: clean. (If `npm run lint` prompts to configure ESLint because no config exists, skip it — note that in the task report.)

Then with `npm run dev`, open `http://localhost:3000/prep/interview` (use the `run` / `claude-in-chrome` skill if driving the browser):
1. Setup renders; "Start mock interview" disabled; type a name → enabled.
2. Add a 2nd interviewer (title only), fill "Your side" with one key point. Wait 1s, reload → everything restored.
3. Start → "Question 1 of N · <Name · Title> asks:". Type a deliberately vague answer (e.g. "It went well.") → Continue → a Follow-up badge appears (usually). Answer it → next question.
4. After one full answer, "End early → get feedback" → feedback renders with Overall / Question by question (with question subheadings) / Key points / Reading the panel / For your next round.
5. "Edit panel" returns to setup with data intact; "Run another round" plans fresh questions.
6. Refresh mid-round → back at setup, panel intact.
7. DevTools Network: no request to PostHog contains interviewer names, answers, or feedback text.

- [ ] **Step 9: Commit**

```bash
git add lib/analytics.ts lib/clientFetch.ts components/PanelSetup.tsx components/InterviewRound.tsx components/InterviewFeedbackSections.tsx components/InterviewSession.tsx app/prep/interview
git commit -m "Add /prep/interview mock-panel UI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Entry points — `/prep` hub + landing strip

**Files:**
- Create: `app/prep/page.tsx`
- Modify: `app/page.tsx` (insert strip after the path-card grid)

**Interfaces:**
- Consumes: `Card`, `Badge`, `Icon` (`components/ui`).
- Produces: `/prep` route; the landing strip linking to it.

- [ ] **Step 1: Create `app/prep/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Interviews & presentations · VocalGym",
  description: "Practice from your notes: a mock interview panel, or a talk you're giving.",
};

export default function PrepHubPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-h2 text-text-primary">
            Practice from your notes
          </h1>
          <p className="mt-2 max-w-prose text-body text-text-body">
            No script needed. Bring what you know, and rehearse out loud.
          </p>
        </div>
        <Link
          href="/"
          className="mt-1 whitespace-nowrap text-body-sm font-medium text-text-muted underline underline-offset-4 transition hover:text-text-primary"
        >
          ← Home
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card as={Link} href="/prep/interview" interactive className="group flex flex-col no-underline">
          <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
            <Icon name="message-square" size={16} />
            Interview
          </span>
          <span className="mt-1.5 flex-1 text-body-sm text-text-body">
            Practice with a mock panel built from what you know about your
            interviewers.
          </span>
          <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-text-accent">
            Start
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </Card>

        <Card tone="sunken" className="flex flex-col" aria-disabled="true">
          <span className="flex items-center gap-2 text-label font-semibold text-text-muted">
            <Icon name="presentation" size={16} />
            Presentation
          </span>
          <span className="mt-1.5 flex-1 text-body-sm text-text-muted">
            Rehearse a talk from your speaker notes or talking points.
          </span>
          <span className="mt-4">
            <Badge tone="outline">Coming soon</Badge>
          </span>
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the strip to `app/page.tsx`**

In `app/page.tsx`, the path cards are rendered inside `<div className="grid gap-4 sm:grid-cols-3">…</div>` within the `max-w-container` `<section>`. Immediately after that grid's closing `</div>` (and before the section's closing `</section>`), insert:

```tsx
        <Link
          href="/prep"
          className="group mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-border-subtle py-4 no-underline"
        >
          <span className="text-body-sm text-text-body">
            Have an interview or presentation coming up?
          </span>
          <span className="inline-flex items-center gap-1 text-body-sm font-medium text-text-accent">
            Practice from your notes
            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </Link>
```

(`Link` is already imported in `app/page.tsx`.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; route list includes `/prep`, `/prep/interview`, `/api/interview-prep`, `/api/interview-questions`, `/api/interview-followup`, `/api/interview-feedback`.

In the browser: `/` shows the three cards unchanged plus the quiet strip beneath them; strip → `/prep`; Interview card → `/prep/interview`; Presentation card is not clickable. Check at phone width (~375px) that the strip wraps cleanly. Spot-check `/script`, `/generate`, `/grill` still load.

- [ ] **Step 4: Commit**

```bash
git add app/prep/page.tsx app/page.tsx
git commit -m "Add /prep hub and landing-page entry strip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Update `CLAUDE.md`**
  - **Tech stack:** add a bullet: "Vitest (`npm test`) — unit tests for pure `lib/` logic only (`lib/**/*.test.ts`); UI verified manually."
  - **Architecture:** under the `/` landing bullets, add `/prep` (hub; Interview live, Presentation "Coming soon"; reached from a strip under the path cards) and a `/prep/interview` bullet describing: `InterviewSession` state machine (setup → planning → round → feedback), `PanelSetup` (1–4 interviewers: name/title/company/about/pastQuestions; optional JD/background/≤5 key points; auto-saved), the three routes (`/api/interview-questions` → `P<n>:` plan parsed by `parseInterviewPlan`; `/api/interview-followup` → `NONE` or one question, malformed ⇒ `{followUp:null}`; `/api/interview-feedback` → 5 sections, Key points conditional), `buildInterviewContext` shared context, `lib/interviewPrep.ts` (pure normalization) vs `lib/interviewPrep.server.ts` (Prisma), `lib/claudeRoute.ts` shared error responses, `lib/clientFetch.ts`. Note v0 scope: rounds not persisted, camera signal unused, no rubric.
  - **Persistence → Models:** add `InterviewPrep` (1:1 with Session, cascade; `panel`/`candidate` Json). **API:** add `GET/PUT /api/interview-prep`.
  - **Usage cap:** add the three interview routes to the list of routes sharing `UsageCounter`.
  - **Observability:** add the three routes to the logger list and their verification codes (`interview_plan_malformed`, `feedback_incomplete`; follow-up degrades to null).
  - **Product analytics:** add the 4 events with their props and the `interview_feedback_rating` survey key; note interviewer profiles are third-party data and never sent.
  - **Not yet built:** add "Presentation mode (speaker notes/talking points → coverage feedback) — `/prep` card is 'Coming soon'", and "Interview rounds aren't persisted (no history/resume)".
- [ ] **Step 2: Update `README.md`** — add `/prep` + `/prep/interview` to the feature/route overview, `npm test` to the scripts/getting-started section, and the `interview_prep` migration note alongside existing migration docs (read the README first and match its existing section structure).
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document interview prep, /prep hub, and Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
