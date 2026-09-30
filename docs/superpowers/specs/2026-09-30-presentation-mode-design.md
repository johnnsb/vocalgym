# Presentation mode — design

Date: 2026-09-30 · Status: approved in brainstorming, pending spec review

## Goal

Let someone rehearse a talk from their **speaker notes or slides** — not a
verbatim script — as one continuous run-through, and get feedback on which
talking points they covered plus how they delivered them, scored with the
existing Effective score. Takes are kept so run 1 can be compared with run 5.

This is the second "practice from your notes" mode (the first is
`/prep/interview`). It replaces the "Coming soon" Presentation card on `/prep`.

### Success criteria
- From `/prep`, a user can open `/prep/presentation`, provide notes (paste or
  .txt/.md/.pdf upload) **or** import a `.pptx` (slide titles + speaker notes,
  parsed in the browser), optionally describe the audience and a time limit.
- They can record one continuous take; with slides, they step through slides
  while recording and the time on each slide is captured.
- They see an Effective score immediately after stopping, then Claude feedback
  covering: Overall / Coverage / Flow & timing / Delivery / Nonverbal (camera
  only) / For your next run.
- Setup survives a refresh; every take with feedback is saved and listed in a
  history (date, duration, Effective score, expandable feedback, deletable).
- No existing flow (`/script`, `/generate`, `/practice`, `/grill`,
  `/prep/interview`) changes behavior; `/practice` history never shows
  presentation takes.

### Non-goals (v1)
- Audience Q&A after the talk (the audience box is context only).
- Slide-by-slide drill mode.
- A numeric coverage score / content-scored qualities (see CLAUDE.md "Open
  questions").
- A rubric picker (the presentation rubric is fixed).
- Rendering slide images; legacy binary `.ppt`.
- Splitting the transcript per slide (timings are captured, text is not).

## User experience

### `/prep` hub
The Presentation card becomes a live link to `/prep/presentation` (same style
as the Interview card). Nothing else on `/prep` changes.

### `/prep/presentation` — setup → run → feedback, history alongside

**1. Setup** (auto-saved)
- **Your talk**: optional title, then a mode switch:
  - **Notes** — large textarea for speaker notes / talking points; upload
    .txt/.md/.pdf via the existing `extractScriptText` (with its trim note).
  - **Slides** — "Import .pptx" button → editable list, one row per slide:
    title + notes textarea. "(no notes)" placeholder when empty. Re-importing
    replaces the list (after the user confirms inline — not a browser dialog).
  - Both the notes and the slide list are kept; the mode decides which is
    used, so switching doesn't lose work.
- **Who's in the room** (optional) — shapes the feedback.
- **Time limit** (optional, minutes).
- **Start run-through** — enabled when the active mode has content (notes
  non-blank, or ≥1 slide with a title or notes).

**2. Run-through**
- One continuous take with `PracticeRecorder` (camera optional).
- Slides mode: current slide's title + notes, "Slide 3 of 8", ← prev /
  next → buttons. Timings: the slide shown when recording starts begins its
  clock; each prev/next click closes the current slide's interval; stopping
  closes the last. Revisiting a slide adds to its total.
- Notes mode: the full notes are shown for reference.
- On stop: the Effective score appears immediately (client-side, like
  `/practice`), plus the editable transcript and **Get feedback**.

**3. Feedback**
- `EffectiveScore` (reused), `NonverbalSummary` (reused, camera only), then
  the feedback sections rendered by `PresentationFeedbackSections`.
- Actions: **Run it again** (back to run-through, same setup) and **Edit
  setup**.
- `FeedbackWidget` prompt, survey key `presentation_feedback_rating`.

**History** — `PresentationHistory` alongside setup/feedback: newest first,
each row shows date, duration, Effective score and the talk title at the time;
expands to the feedback; delete per row.

## Data & persistence

### Types (`lib/types.ts`)
```ts
interface PresentationSlide { id: string; title: string; notes: string }
interface PresentationPrep {
  title: string;
  mode: "notes" | "slides";
  notes: string;
  slides: PresentationSlide[];
  audience: string;
  timeLimitMin: number | null;
}
interface SlideTiming { slideId: string; seconds: number }
interface PresentationTake {
  id: string;
  createdAt: string;        // ISO
  talkTitle: string;
  durationSec: number;
  transcript: string;
  feedback: string;
  effective: EffectiveResult | null;
  nonverbal: NonverbalMetrics | null;
  slideTimings: SlideTiming[] | null;
}
interface PresentationFeedbackRequest {
  prep: PresentationPrep;
  transcript: string;
  durationSec: number;
  slideTimings: SlideTiming[] | null;
  nonverbal: NonverbalMetrics | null;
  signals: ObservableSignals | null;
}
interface PresentationFeedbackResponse { feedback: string }
```

### Prisma
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
`Session` gains `presentationPrep PresentationPrep?` and
`presentationTakes PresentationTake[]`. Migration:
`npm run db:migrate -- --name presentation_mode`. Deliberately separate from
`Attempt`.

### Limits (server-validated; over-limit text truncated, not rejected)
| Field | Limit |
|---|---|
| title / talkTitle | 120 chars |
| notes | 12,000 chars |
| slides | ≤40; slide title 200 chars; slide notes 2,000 chars |
| all slide notes combined | 20,000 chars (later slides' notes cut first) |
| audience | 2,000 chars |
| timeLimitMin | integer 1–120, else `null` |
| mode | `"notes"` \| `"slides"`, default `"notes"` |
| transcript (take/feedback) | 60,000 chars (~1 hour of speech; raised from 12,000 after final review) |
| feedback (take) | 40,000 chars |
| durationSec | integer 0–10,800 |
| slideTimings | ≤40 entries, `seconds` 0–10,800, unknown slide ids dropped |

Slide ids: client-generated, de-duplicated like interview ids.

### API (session-scoped via `vg_sid`)
- `GET /api/presentation-prep` → `PresentationPrep` (defaults if no row);
  `PUT` → validates, upserts, returns the stored prep.
- `GET /api/presentation-takes` → `PresentationTake[]`, newest first (≤50).
- `POST /api/presentation-takes` → validates, inserts, prunes to newest 50,
  returns the row. Called by the client after feedback succeeds (same pattern
  as `/practice`'s `addAttempt`); failure is non-fatal.
- `DELETE /api/presentation-takes/[id]` → deletes only if it belongs to this
  session (foreign id = no-op).

### Modules
- `lib/presentationPrep.ts` — pure: limits, `emptyPresentationPrep`,
  `normalizePresentationPrep`, `normalizeSlideTimings`, `presentationHasContent`,
  `normalizeTakeInput`.
- `lib/presentationPrep.server.ts` — `getPresentationPrep`,
  `savePresentationPrep`, `listTakes`, `addTake`, `removeTake`.
- `lib/presentationStore.ts` — client fetch wrappers (setup save supports
  `keepalive`).
- Setup auto-save reuses the interview behavior: ~800ms debounce, saves only
  after a successful load (`shouldPersist` from `lib/interviewRound.ts`), and
  flushes a pending save on unmount / `pagehide` with `keepalive`.

### Privacy
Notes, slides, audience and transcripts are the user's content: stored only on
their session's rows, sent to Anthropic only as prompt context, never passed to
PostHog, never previewed in server logs.

## Feedback call

`POST /api/presentation-feedback` — body `PresentationFeedbackRequest` →
`{ feedback }`. Full `lib/logger.ts` lifecycle, Sentry on failures,
`recordRequest()` demo cap (429 `demo_limit_reached` via `lib/claudeRoute.ts`),
`MODEL`, `max_tokens` 3000. Validation: prep via `normalizePresentationPrep`;
400 if the active mode has no content or the transcript is empty; transcript
≤60,000; timings via `normalizeSlideTimings`. The route recomputes the
Effective result from `coerceSignals(signals)` + `PRESENTATION_RUBRIC` for the
prompt (as `practice-feedback` does).

### Prompt (`lib/prompt.ts`)
`PRESENTATION_FEEDBACK_SYSTEM_PROMPT` + `buildPresentationFeedbackPrompt(...)`.
Context in XML tags:
- `<talk title="…">` containing either `<slide tag="S1">` blocks (Title:,
  `<notes>`, or "(no notes)") or `<notes>` for notes mode
- `<audience>` and `<time_limit minutes="N" />` when present
- `<slide_timings>` lines like `S3 Pricing: 2:40`, plus total duration
- the Effective block via `formatRubricForPrompt`, and the camera summary via
  `formatNonverbalForPrompt` when present
- `<transcript>` labelled as speech-to-text

Required output, bold headings in this order:
- **Overall** — 2–3 sentences, names the Effective score.
- **Coverage** — slides mode: one bullet per slide `S<n> <title> — covered |
  partly | missed: …`; notes mode: identify up to ~8 main talking points from
  the notes, one bullet each with the same verdicts.
- **Flow & timing** — order, per-slide pacing (when timings exist), total vs.
  time limit (when set).
- **Delivery** — pace, fillers, and the weakest highest-weighted quality.
- **Nonverbal** — only when camera metrics are present.
- **For your next run** — 2–3 prioritized changes.

### Verification (`lib/verifyOutput.ts`)
`verifyPresentationFeedback(text)`: requires Overall, Coverage, Flow & timing,
Delivery, For your next run, matched only at bold or `#`/`##` headings
(`SECTION_HEAD`); Nonverbal optional. Failure → logged + Sentry + 502
`code: "feedback_incomplete"`.

## Scoring

`PRESENTATION_RUBRIC` in `lib/rubric.ts` — a fixed `RubricSelection`,
**Clear 30 · Confident 25 · Connected 25 · Smooth 20**, `custom: false`. Not a
`Tone` (so the `/script` and `/generate` tone dropdowns are unchanged). The
client computes `computeSignals` + `computeEffective(PRESENTATION_RUBRIC, …)`
on stop; the route recomputes for the prompt.

## .pptx import (`lib/pptxImport.ts`)

- Dynamically imported only when the user picks a `.pptx`. New direct
  dependency: `fflate` (unzip).
- `extractSlides(file: File): Promise<{ slides, truncated, hadNotes }>`:
  unzip → read `ppt/presentation.xml` (`p:sldIdLst` order) +
  `ppt/_rels/presentation.xml.rels` to map ids → slide paths → for each slide,
  its `_rels` to find the `notesSlide`.
- Pure string helpers (unit-testable in Node, no DOM): `slideOrder(presXml,
  relsXml)`, `slideTitle(slideXml)` (text of the `p:sp` whose placeholder is
  `type="title"` or `"ctrTitle"`), `notesText(notesXml)` (text of the body
  placeholder, excluding `type="sldNum"`, paragraphs joined by newlines), XML
  entity decoding.
- Errors: legacy `.ppt` → "Save it as .pptx and try again."; unreadable zip /
  missing `presentation.xml` → "Couldn't read that PowerPoint file."; zero
  slides → "That deck has no slides." >40 slides or >20,000 notes chars →
  trimmed + note; no notes anywhere → titles imported + hint "No speaker notes
  found — add talking points per slide."

## Components

| File | Role |
|---|---|
| `app/prep/page.tsx` | Presentation card becomes a live link (only change to an existing page) |
| `app/prep/presentation/page.tsx` | page shell |
| `components/PresentationSession.tsx` | state machine `loading → setup → run → feedback-loading → feedback`; setup load/save; take state; API calls; analytics |
| `components/PresentationSetup.tsx` | title, mode switch, notes box + upload, audience, time limit |
| `components/SlideListEditor.tsx` | .pptx import button + editable slide rows + re-import confirm |
| `components/PresentationRun.tsx` | slide stepper + timing capture + `PracticeRecorder` + transcript |
| `components/PresentationFeedbackSections.tsx` | standalone renderer for the section set |
| `components/PresentationHistory.tsx` | take list, expand, delete |

Reused unchanged: `PracticeRecorder`, `EffectiveScore`, `NonverbalSummary`,
`FeedbackWidget`, `extractScriptText`, `components/ui`, `lib/clientFetch.ts`,
`lib/claudeRoute.ts`, `shouldPersist`.

Slide timing is a pure helper in `lib/presentationPrep.ts`:
`accumulateTimings(events: { slideId: string; at: number }[], stopAt: number):
SlideTiming[]` — unit-tested.

## Analytics (PostHog)
New `EVENTS` (counts/categories only):
- `presentation_setup_saved` — `{ mode, slide_count, has_audience, has_time_limit }` (on Start)
- `presentation_take_completed` — `{ used_video, duration_sec, slide_count }`
- `presentation_feedback_received` — `{ effective_score, effective_band, used_video }`

## Error handling

| Failure | Behavior |
|---|---|
| Feedback call fails / 502 / cap | Callout + Retry; transcript, score, timings kept in memory; take saved only after feedback succeeds |
| Take save fails | small caution Callout; feedback stays on screen |
| Setup load fails | GET retried once; then "couldn't load your saved setup" and no saving this visit |
| Setup save fails | non-blocking caution Callout |
| .pptx problems | inline Callout per the import errors above; existing slides untouched |
| Mic / transcription | handled by `PracticeRecorder` |

## Testing

Vitest, test-first:
- `normalizePresentationPrep` / `normalizeTakeInput` / `normalizeSlideTimings` — every limit, mode default, time limit bounds, combined-notes cap, id de-dup.
- `accumulateTimings` — single slide, back-and-forth revisits, stop closes last interval.
- `presentationHasContent` — per mode.
- pptx helpers — slide order from `sldIdLst` (not file name), title vs. body, `sldNum` excluded, entity decoding, no-notes deck; one end-to-end `extractSlides` on a tiny `.pptx` built in-memory with `fflate`.
- `buildPresentationFeedbackPrompt` — slides vs. notes mode, optional audience/limit/timings/nonverbal blocks.
- `verifyPresentationFeedback` — required sections, Nonverbal optional, `###` subheading can't satisfy a section.
- `PRESENTATION_RUBRIC` weights sum to 100 and use valid attributes.

Browser: import a real `.pptx`, run-through with slide stepping, feedback,
history (expand/delete), setup restore after refresh; `/practice` history
unaffected. One live Claude call. `npx tsc --noEmit`, `npm test`,
`npm run build` pass.

## Docs
Update CLAUDE.md (Architecture: `/prep/presentation`, models, routes, rubric,
pptx import, events; "Not yet built": remove presentation mode, add Q&A /
drill mode / coverage score as follow-ups) and README.md.
