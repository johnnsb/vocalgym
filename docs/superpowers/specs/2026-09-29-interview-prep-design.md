# Interview prep (mock panel) — design

Date: 2026-09-29 · Status: approved in brainstorming, pending spec review

## Goal

Let someone practice for an interview **without a script**: they describe who
they're meeting (anything they know about each interviewer) and optionally
their own side (job description, resume, key points), then run a short mock
interview answered out loud, and get feedback grounded in that context.

This is the first of two "practice from your notes" modes. The second —
**presentation** (speaker notes / talking points as context, feedback on
coverage) — is out of scope here; it appears only as a "Coming soon" card.

### Success criteria
- From `/`, a user can reach interview practice via one clearly secondary
  entry point that does not change the three main path cards.
- A user can describe a 1–4 person panel, run a 4–5 question mock round with
  adaptive follow-ups, and receive per-question + overall feedback that
  references their actual context (interviewer priorities, resume examples,
  key points).
- The panel setup survives a refresh / return visit (same browser session).
- No existing flow (`/script`, `/generate`, `/practice`, `/grill`) changes
  behavior.

### Non-goals (v0)
- Presentation mode.
- Persisting rounds (questions/transcripts/feedback) or showing round history.
- Using the camera/nonverbal signal or the rubric/Effective score.
- Fetching LinkedIn (or any) URLs — users paste profile text or upload
  LinkedIn's "Save to PDF" export.
- A `SiteHeader` nav link.

## User experience

### Entry point — `/`
One quiet full-width strip directly under the three path cards:
"Have an interview or presentation coming up? Practice from your notes →",
linking to `/prep`. Built from design-system primitives/token utilities; no
new colors. Nothing else on the landing page changes.

### `/prep` — hub
Two cards:
- **Interview** — "Practice with a mock panel." → `/prep/interview`
- **Presentation** — disabled, "Coming soon".

### `/prep/interview` — one page, three stages

**1. Setup**
- **Your panel** — 1–4 interviewer cards (starts with one; "Add interviewer";
  remove button when >1). Each card:
  - optional quick fields: name, title, company
  - "What do you know about them?" — large textarea + upload
    (.txt/.md/.pdf via existing `extractScriptText`); hint mentions LinkedIn
    "Save to PDF"
  - "Questions they've asked before" — smaller textarea
- **Your side** (collapsible, all optional): job description (paste/upload),
  your resume / background (paste/upload), key points to land (up to 5 short
  inputs).
- Auto-saves (debounced ~800ms) and restores on return.
- **Start mock interview** — enabled when at least one interviewer has any
  content (name, title, company, or about). Saves immediately, then requests
  the question plan.

**2. Round**
- One question at a time, attributed: "Priya Shah · VP Engineering asks:"
  (falls back to "Interviewer 2" when unnamed).
- Answered with the existing `PracticeRecorder` (`contentLabel="Question"`).
- After each answer: brief "thinking…" state, then either a follow-up from the
  same panelist (max one per question) or the next planned question.
- Progress: "Question 2 of 5". "End early → get feedback" available once at
  least one answer is recorded.

**3. Feedback**
- Rendered markdown: Overall → Question by question → Key points (only if
  given) → Reading the panel → For your next round.
- Actions: "Run another round" (same panel, new plan) and "Edit panel"
  (back to setup).
- `FeedbackWidget` smiley prompt (survey key `interview_feedback_rating`).

Refreshing mid-round returns to setup with the panel intact.

## Data & persistence

### Prisma model
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
`Session` gains `interviewPrep InterviewPrep?`. Separate table (not a column on
`Session`) so it stays out of the `GET /api/state` hydration payload and the
feature stays isolated. Migration: `npm run db:migrate -- --name interview_prep`.

### Types (`lib/types.ts`)
```ts
interface InterviewPanelist {
  id: string;            // client-generated (newId), stable across edits
  name: string;
  title: string;
  company: string;
  about: string;         // anything known: bio, LinkedIn text, writing, history
  pastQuestions: string; // questions they've asked before (free text)
}
interface InterviewCandidate {
  jobDescription: string;
  background: string;    // resume / notes
  keyPoints: string[];
}
interface InterviewPrepState { panel: InterviewPanelist[]; candidate: InterviewCandidate; }
interface PlannedQuestion { panelistId: string; question: string; }
interface InterviewExchange {
  panelistId: string;
  question: string;
  transcript: string;
  followUp?: string;
  followUpTranscript?: string;
}
```

### Limits (server-validated; over-limit text is truncated, not rejected)
| Field | Limit |
|---|---|
| panel size | 1–4 (extras dropped; empty panel → one blank panelist) |
| name / title / company | 120 chars |
| about | 8,000 chars (`MAX_SCRIPT_CHARS`) |
| pastQuestions | 2,000 chars |
| jobDescription, background | 8,000 chars each |
| keyPoints | ≤5 items, 200 chars each, blanks dropped |

Non-string fields are coerced to `""`; unknown keys dropped.

### API (session-scoped via `vg_sid`, same pattern as `/api/state`)
- `GET /api/interview-prep` → `InterviewPrepState` (empty defaults if no row)
- `PUT /api/interview-prep` → body `InterviewPrepState`; validates/normalizes,
  upserts, returns the stored state.

### Modules
- `lib/interviewPrep.server.ts` — `normalizePrep(input)` (pure; all limits
  above), `getPrep(sessionId)`, `savePrep(sessionId, input)`.
- `lib/interviewPrepStore.ts` (client) — `loadPrep()`, `savePrep(state)`
  fetch wrappers.

### Privacy
Interviewer profiles are third-party personal data. They are stored only on
this session's row, sent to Anthropic only as prompt context (same as scripts
today), and **never** passed to PostHog (`track()` props stay primitives:
counts/booleans only).

## AI calls

All three: `MODEL` (Sonnet), full `lib/logger.ts` lifecycle logging,
`Sentry.captureException`/`captureMessage` tagged with route + request id,
output checked in `lib/verifyOutput.ts`, and each counts against the shared
`UsageCounter` demo cap via `recordRequest` (blocked → same 429 shape as other
Claude routes).

A shared `buildInterviewContext(panel, candidate)` in `lib/prompt.ts` renders
the panel (labelled `P1`…`Pn`, in array order) and candidate sections once;
all three prompts use it. Empty fields are omitted.

### 1. `POST /api/interview-questions`
- Request `{ panel, candidate }` → response `{ questions: PlannedQuestion[] }`.
- `INTERVIEW_PLAN_SYSTEM_PROMPT`: produce 4–5 questions in realistic interview
  order (warm opener → substantive → closing), distributed across panelists,
  each in that panelist's voice/priorities; if any panelist has
  `pastQuestions`, include at least one of them verbatim or lightly adapted;
  target the job description and specific resume items when given. Each
  question single, direct, one sentence (answered aloud).
- Output format: one per line, `P<n>: <question>`. No other text.
- Parser `parseInterviewPlan(text, panel)` in `lib/anthropic.ts`: maps `P<n>`
  to `panel[n-1].id`; ignores blank lines; strips numbering/bullets before the
  tag. Never truncates.
- `verifyInterviewPlan`: 3–6 questions; every tag resolves to a panelist;
  each question passes the existing complete-question rule (ends in "?",
  ≤400 chars). Failure → 502 `code: interview_plan_malformed`.

### 2. `POST /api/interview-followup`
- Request `{ panel, candidate, panelistId, question, transcript,
  upcomingQuestions: string[] }` → `{ followUp: string | null }`.
- `INTERVIEW_FOLLOWUP_SYSTEM_PROMPT`: as that panelist, either press on one
  concrete thing in the answer (a vague claim, missing result, unexplained
  decision) with a single one-sentence question, or reply exactly `NONE` if the
  answer was complete. Must not overlap `upcomingQuestions`.
- Parser `parseFollowUp(text)`: `NONE` (case-insensitive, trimmed, optional
  trailing punctuation) → `null`; otherwise the cleaned question.
- Verification: a non-null follow-up must pass the complete-question rule. A
  malformed reply is logged + sent to Sentry but **returned as
  `{ followUp: null }` with 200** — the round never stalls on a follow-up.
- Client enforces at most one follow-up per planned question (it simply never
  requests one for a follow-up answer).

### 3. `POST /api/interview-feedback`
- Request `{ panel, candidate, exchanges: InterviewExchange[] }` (≥1) →
  `{ feedback: string }` (markdown).
- `INTERVIEW_FEEDBACK_SYSTEM_PROMPT`: transcripts are speech-to-text (ignore
  noise). Sections, exactly these headings:
  - `**Overall**`
  - `**Question by question**` — a `###` subheading per question, 2–3 bullets
    each; call out a stronger resume example when one was available
  - `**Key points**` — only when key points were provided: which landed,
    which didn't come up
  - `**Reading the panel**` — how well answers matched what each interviewer
    appears to care about
  - `**For your next round**` — 2–3 concrete changes
- `verifyInterviewFeedback(text, hasKeyPoints)`: Overall, Question by question,
  Reading the panel, For your next round required; Key points required only
  when `hasKeyPoints`. Failure → 502 `code: feedback_incomplete`.

Cost per round: 1 plan + ≤5 follow-ups + 1 feedback = 3–7 capped calls.

## Components

| File | Role |
|---|---|
| `app/page.tsx` | + the entry strip under the path cards (only change to an existing page) |
| `app/prep/page.tsx` | hub: Interview card + disabled Presentation card |
| `app/prep/interview/page.tsx` | renders `InterviewSession` |
| `components/InterviewSession.tsx` | state machine `setup → planning → round → feedback`; owns plan, exchanges, current index |
| `components/PanelSetup.tsx` | interviewer cards + "Your side"; debounced save via `interviewPrepStore` |
| `components/InterviewRound.tsx` | current question + attribution + progress + `PracticeRecorder` (`contentLabel="Question"`) + "End early" |
| `components/InterviewFeedbackSections.tsx` | standalone markdown renderer for the interview section set |

`PracticeRecorder`, `extractScriptText`, `FeedbackWidget`, and `components/ui`
primitives are reused unchanged. `/grill` is untouched.

## Analytics (PostHog)

New `EVENTS` constants in `lib/analytics.ts`; props are counts/booleans only:
- `interview_setup_saved` — `{ panel_size, has_jd, has_background, key_points_count }`
  (fired on Start, not on every debounced save)
- `interview_round_started` — `{ panel_size, question_count }`
- `interview_round_completed` — `{ answered, followups, ended_early, duration_sec }`
- `interview_feedback_received` — no props

Pageviews for `/prep` and `/prep/interview` come from the existing
`PageviewTracker`.

## Error handling

| Failure | Behavior |
|---|---|
| Plan call fails / 502 / cap reached | `Callout tone="critical"` on setup with Retry; setup untouched |
| Follow-up call fails or malformed | silently advance to next question |
| Feedback call fails | Callout with Retry; exchanges kept in memory, nothing re-recorded |
| Prep save fails | non-blocking caution Callout ("couldn't save your panel"); Start still works using in-memory state |
| Mic / transcription | handled by `PracticeRecorder` as today |

## Testing

Add **Vitest** (devDependency, `npm test`) scoped to new pure logic, written
test-first:
- `parseInterviewPlan` — valid tags, bullets/numbering stripped, unknown tag,
  too few/many, blank lines.
- `parseFollowUp` — `NONE` variants, real question, empty.
- `verifyInterviewPlan`, `verifyInterviewFeedback` — required sections,
  conditional Key points.
- `normalizePrep` — every limit in the table, coercion, empty panel.
- `buildInterviewContext` — omits empty fields, `P<n>` labelling.

UI flow verified manually in the browser (setup → round with ≥1 follow-up →
feedback; refresh restores panel; landing strip; `/grill` and main flows
unaffected). `npm run build` and `tsc` must pass.

## Docs
Update CLAUDE.md (Architecture: `/prep` + `/prep/interview`, model, routes,
events, Vitest; "Not yet built": presentation mode, round persistence) and
README.md.
