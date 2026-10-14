# Presentation mode — audience Q&A — design

Date: 2026-10-03 · Status: decided autonomously (user asked for items 1–4
without check-ins); reviewed by a fresh reviewer before merge.

## Goal
After a run-through, optionally face 2 audience questions grounded in what the
speaker actually said (and who's in the room), answer them out loud, and get
the Q&A judged in the same feedback.

## Decisions
- **Opt-in** per setup: `PresentationPrep.audienceQa: boolean` (default
  `false`), a checkbox "Finish with audience questions" in setup.
- **Flow:** run → (if on) **Continue to audience questions** → `qa-loading` →
  `qa` (question 1 of 2, `PracticeRecorder` + editable transcript, Continue)
  → feedback. "Skip questions → get feedback" is always available; unanswered
  questions are dropped.
- **Exactly 2 questions**, one Claude call: `POST /api/presentation-questions`
  `{ prep, transcript }` → `{ questions: string[] }`. Prompt: answer as a
  member of the described audience; one question probing a claim/number or
  something unclear in what they said, one about what's missing, risk, or
  next steps; single sentence ending "?", under 30 words; reply as a numbered
  list. Parsed with the existing numbered-list parser (exported from
  `lib/anthropic.ts`); verified with `verifyQuestions` + count 1–3 (first 2
  kept) → 502 `questions_malformed`. No follow-ups (YAGNI).
- **Feedback:** `POST /api/presentation-feedback` accepts optional
  `qa: { question, answer }[]` (≤3; question ≤500, answer ≤12,000 chars;
  blank answers dropped). When present the prompt adds an `<audience_qa>`
  block and a required **Q&A** section (2–3 bullets: directness, accuracy vs.
  the talk, composure); `verifyPresentationFeedback(text, { hasQa })` requires
  it only then.
- **Storage:** `PresentationTake.qa Json?` (migration `presentation_take_qa`);
  history marks runs that included Q&A.
- **Shared context:** the `<talk>` / `<audience>` / `<time_limit>` block is
  extracted into `buildTalkContext(prep)` and used by both prompts.
- **Analytics:** `presentation_qa_completed` `{ asked, answered }`.
- **Cost:** +1 Claude call per run when Q&A is on (capped by the demo
  counter like every Claude route).

## Testing
Vitest first: `audienceQa` normalization, `normalizeQa`, question-prompt
builder, feedback prompt with/without Q&A, verifier `hasQa`,
`normalizeTakeInput` keeps `qa`. Live: one questions call + one feedback call
with Q&A via curl on a fresh cookie session (never the user's session).
