# VocalGym

AI-assisted communication practice platform. Users describe a difficult
situation, get an AI-generated script (or upload their own), then practice
delivering it and receive feedback on content, vocal delivery, and nonverbal
signals — rolled up into a single "Effective" score.

## Tech stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Design system (`components/ui/` + `app/styles/tokens.css`) ported from the
  "VocalGym Design System" Claude Design project — warm neutral palette, single
  Ember accent, Source Serif 4 (`next/font`) headlines + Public Sans everywhere
  else, `lucide-react` icons. See "## Design system" below.
- Prisma 6 (`@prisma/client` + `prisma`) against Neon Postgres — pooled
  connection (`DATABASE_URL_POOLED`, has `?pgbouncer=true`) for runtime, direct
  connection (`DATABASE_URL`) for migrations. This is the source of truth for
  the current script, rubric, practice attempts, expert requests, and the demo
  usage counter — localStorage is no longer used for app data. The Prisma CLI
  reads `.env`, so the two `DATABASE_*` vars live there as well as `.env.local`.
- Anthropic API for script generation + feedback (`MODEL = claude-sonnet-5` in
  `lib/anthropic.ts`) and for the tiny script-title task
  (`LABEL_MODEL = claude-haiku-4-5-20251001`)
- Web Speech API for live transcription during practice
- MediaRecorder API for audio capture; Web Audio API (AnalyserNode/RMS) for a
  rough volume + steadiness read
- MediaPipe (Face Landmarker, Pose Landmarker) for the video signal —
  client-side, free, no API key, lazy-loaded only when the camera is enabled.
  Chosen over Hume/Google Cloud Video Intelligence for now; those are
  candidates for a later paid upgrade once the UX is validated.
- pdfjs-dist for parsing uploaded PDF scripts (client-side, dynamically
  imported only on first PDF use)
- Vitest 3 (`npm test`, `vitest.config.ts`) — unit tests for pure `lib/`
  logic only (`lib/**/*.test.ts`: interview normalization, prompt builders,
  parsers, output verifiers). UI flows are verified manually in the browser.
  Pinned to v3 because v5 peer-requires `@types/node` ≥22 and the repo is on 20.
- Sentry (@sentry/nextjs v10) for error tracking — gated on
  NEXT_PUBLIC_SENTRY_DSN (blank = fully disabled, zero client-bundle cost;
  `next.config.mjs` only wires in `withSentryConfig` when the DSN is set). A DSN
  is currently configured in .env.local, so it's active — including in
  `npm run dev` (events tagged `environment: development`). Source-map upload is
  wired into `next.config.mjs` (`org` / `project` / `authToken` read from
  SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN) and stays disabled unless
  all three are set; to enable it, add all three (in `.env.local` for a local
  prod build, or as host/CI secrets) and `next build` uploads source maps.
  Without them it still builds, with minified stack traces. See .env.example
  for what each value is. **Unverified:** whether this plugin version deletes
  the generated `.map` files after uploading, or leaves them publicly served
  next to the JS — check the build output the first time a real token is set.
- PostHog (posthog-js v1) for product analytics + in-app feedback surveys —
  gated on NEXT_PUBLIC_POSTHOG_KEY (blank = fully disabled, SDK never imported,
  zero client-bundle cost — `posthog-js` is a lazy `import()` in
  `lib/analytics.ts`). Optional NEXT_PUBLIC_POSTHOG_HOST (default
  `https://us.i.posthog.com`, which is what's in use). A key IS configured in
  .env.local now, so analytics is LIVE — including in `npm run dev`, and the
  `FeedbackWidget` smiley prompts render. Navigation + named interaction events
  ONLY — autocapture, session recording, and anonymous person profiles are all
  disabled; script/transcript/feedback text is never sent (see Observability
  below).

## Architecture
- `/` — landing page: nav (shared `SiteHeader` in `app/layout.tsx`), tagline,
  and three path cards that branch the old combined form:
  - `/script` (`BringScriptFlow`) — "I know what I want to say". If a script is
    already saved for this session it's shown with "use as-is" / "write my own";
    if not, a plain paste box (+ upload .txt/.md/.pdf, parsed in the browser) →
    tone → "Continue to practice". source = "uploaded".
  - `/generate` (`GenerateFlow`) — "help me find the words": situation + tone →
    POST /api/generate-script → `{ script, label }` → `ScriptResult`.
    source = "generated".
  - `/experts` (`ExpertRequestForm`) — NOT an AI feature. A contact form
    (situation + name + email) → POST /api/expert-request → `ExpertRequest`
    table. Confirmation message shown; requests are fulfilled manually via
    `/admin/requests` (token-gated by USAGE_ADMIN_TOKEN when set) or
    GET /api/expert-request.
  - `/how-it-works` — stub content page (the 3-step loop, expanded from the
    landing-page section); linked from `SiteHeader`, the landing `#how-it-works`
    section ("Read the full walkthrough"), and the footer.
  - `/faq` — stub with a handful of real short Q&As (accounts, storage, camera,
    cost, browsers); linked from `SiteHeader` and the footer.
  - `/signin` — thin "coming soon" stub page.
  - `/prep` — "Practice from your notes" hub, reached ONLY from a quiet strip
    under the three path cards ("Have an interview or presentation coming
    up?") — deliberately kept out of the main three-path flow and the nav.
    Interview card → `/prep/interview`; Presentation card is a disabled
    "Coming soon".
  Both `/script` and `/generate` also render the effectiveness rubric picker.
- `/prep/interview` (`InterviewSession`) — mock interview with no script. State
  machine `loading → setup → planning → round ⇄ followup-loading →
  feedback-loading → feedback`.
  - Setup (`PanelSetup.tsx`, controlled): 1–4 interviewers (name / title /
    company / "what do you know about them?" / "questions they've asked
    before", upload via `extractScriptText`) + optional candidate side (job
    description, background, ≤5 key points). Persisted per session in the
    `InterviewPrep` table via `GET/PUT /api/interview-prep`
    (`lib/interviewPrep.server.ts`, client `lib/interviewPrepStore.ts`);
    auto-save is debounced ~800ms and only fires when the form differs from
    the last-saved JSON snapshot. No LinkedIn URL fetching.
  - `lib/interviewPrep.ts` is the PURE half (limits, `normalizePrep`,
    `normalizeExchanges`, `panelistLabel`, `hasPanelContent`) — used by
    routes, server, and client; unit-tested. Limits: panel 1–4; name/title/
    company 120; about 8,000; pastQuestions 2,000; JD/background 8,000;
    key points ≤5 × 200. Over-limit text is truncated, never rejected.
  - Three Claude routes, all sharing `buildInterviewContext` (XML-tagged
    `<panel>` with `P1..Pn` interviewer tags + candidate sections) in
    `lib/prompt.ts`:
    `POST /api/interview-questions` → `INTERVIEW_PLAN_SYSTEM_PROMPT`, 4–5
    `P<n>: question` lines parsed by `parseInterviewPlan` (tolerates bullets/
    bold/numbering; out-of-range tag → empty id) and checked by
    `verifyInterviewPlan` (3–6, known panelists, complete questions) → 502
    `interview_plan_malformed`.
    `POST /api/interview-followup` → `NONE` or one question
    (`parseFollowUp`: NONE variants → null, but "None of…?" is a question);
    a malformed follow-up is logged + Sentry'd and returned as
    `{ followUp: null }` (200) so the round never stalls. Client asks at most
    one follow-up per planned question.
    `POST /api/interview-feedback` → Overall / Question by question (`###`
    per question) / Key points (only when given) / Reading the panel / For
    your next round; `verifyInterviewFeedback(text, hasKeyPoints)` → 502
    `feedback_incomplete`. A follow-up shown but never answered (ended early)
    is dropped by `normalizeExchanges` and never reaches the prompt.
  - `lib/claudeRoute.ts` (`demoLimitResponse`, `anthropicErrorResponse`) and
    `lib/clientFetch.ts` (`postJSON`) are shared helpers used ONLY by the
    interview routes/UI — the older routes keep their inline copies.
  - `InterviewFeedbackSections.tsx` is its own renderer (anchored section
    regexes so a `### question` subheading can't be mistaken for a section).
  - **v0 scope**: rounds not persisted (refresh → setup with the panel
    intact), camera toggle works but its signal is unused, no rubric/
    Effective score. Interviewer profiles are third-party personal data —
    never sent to PostHog and not previewed in server logs.
- `/practice` — practice session: record audio (+ optional video), transcribe,
  submit to POST /api/practice-feedback for Claude-generated coaching notes.
  Camera frames never leave the browser — only the derived metric summary and
  the Effective score are sent. The rubric strip's "change" does `router.back()`.
- `/grill` (`GrillSession`) — "defend your work" v0 prototype: upload/paste
  material → POST /api/generate-questions → a numbered list of likely reviewer
  questions (prompted to be single, direct, one-sentence questions — they're
  answered out loud) → pick one → record an answer (`PracticeRecorder`, reused as-is
  plus one new optional `contentLabel` prop so its side panel says "Question"
  instead of "Script") → POST /api/followup-question (original question +
  transcript + source material + the other questions, so it doesn't duplicate
  their ground) → one Claude-generated follow-up that presses on something
  concrete in the answer → record that too → POST /api/qa-feedback → qualitative
  markdown feedback (`QAFeedbackSections.tsx`, a standalone renderer — not a
  reuse of `FeedbackSections.tsx`, which is practice-feedback's and has a
  different fixed section set) across both exchanges. Deliberately isolated
  from the script/practice flow: no shared state, own types
  (`GenerateQuestionsRequest/Response`, `QAExchange`,
  `FollowUpQuestionRequest/Response`, `QAFeedbackRequest/Response` in
  `lib/types.ts`), own prompt pairs in `lib/prompt.ts`
  (`QUESTION_SYSTEM_PROMPT`/`FOLLOWUP_SYSTEM_PROMPT`/`QA_FEEDBACK_SYSTEM_PROMPT`
  + builders), own calls in `lib/anthropic.ts` (`generateQuestions`,
  `generateFollowUpQuestion`, `generateQAFeedback`), own checks in
  `lib/verifyOutput.ts` (`verifyQuestions`/`verifyFollowUp`/`verifyQAFeedback`).
  **v0 scope, deliberately**: no persistence (nothing saved as an `Attempt`,
  nothing survives a refresh — `startOver()` just resets component state), no
  rubric/Effective-score involvement (the camera toggle in `PracticeRecorder`
  still works but its signal goes unused here), no nav link yet (reachable only
  at `/grill` directly), not wired to PostHog. See "Open questions" for the
  follow-on (content-scored qualities) this would need to plug into the rubric.
- Persistence: **Postgres via Prisma**, scoped to an anonymous session.
  - Identity: `middleware.ts` ensures every request carries a `vg_sid` httpOnly
    cookie (random UUID) and forwards it to route handlers via an `x-vg-sid`
    request header. `lib/session.ts` `getSessionId()` reads it; `ensureSession()`
    upserts the `Session` row. No accounts yet — the cookie *is* the user.
  - Models (`prisma/schema.prisma`): `Session` (1 per browser; `currentScript`
    and `rubric` are `Json?` blobs — StoredScript / RubricSelection shapes),
    `Attempt` (FK → Session, cascade; newest 50/session kept), `InterviewPrep`
    (1:1 with Session, cascade; `panel` / `candidate` Json), `ExpertRequest`,
    `UsageCounter` (single row id=1). There is no scripts table — the
    `currentScript` blob carries `id` + `label` (see below), and `Attempt` has
    denormalized `scriptId` / `scriptLabel` columns so history can be grouped.
  - Script id + label: `patchState` assigns `currentScript.id` (a UUID) the
    first time a script is saved and keeps it stable while the text is
    unchanged, minting a fresh one when the text changes. `currentScript.label`
    is a 2–4 word Claude title — the **generate** path gets it in the same
    response (Claude emits a leading `Title:` line, split off in
    `lib/anthropic.ts` `generateScript`), the **bring-your-own** path gets it
    from a separate cheap Haiku call (`POST /api/script-label`) in
    `goPractice()`. Each saved attempt copies the current `scriptId` + `label`.
  - `lib/sessionState.server.ts` is the server data layer (`getState`,
    `patchState`, `addAttempt`, `removeAttempt`, `clearAttempts`) and validates
    every untrusted blob before it's stored.
  - API: `GET /api/state` → `{ currentScript, rubric, attempts }` (one-shot
    hydration for every page), `PATCH /api/state` → partial
    `{ currentScript?, rubric? }`, `POST /api/attempts` (returns the row, takes
    `scriptId` / `scriptLabel`), `DELETE /api/attempts` (clear all),
    `DELETE /api/attempts/[id]` (one, session-scoped so a foreign id is a
    no-op), `POST /api/script-label` (Haiku, best-effort → `{ label }`, not
    counted against the demo cap), `GET/PUT /api/interview-prep` (the
    session's interview panel setup; normalized on write and read).
  - `PastAttempts.tsx` groups the history by `scriptId` — a header per script
    (its `scriptLabel`, falling back to the situation text), groups ordered by
    most-recently-practiced, attempts within a group newest-first, each row
    still individually collapsible.
  - `lib/practiceStore.ts` (client) is now an async fetch wrapper over those
    endpoints — same function names, all Promise-returning, with a ~1.5s
    in-flight cache so a page with two consumers issues one GET. Draft-sync
    effects in the entry flows are debounced (~800ms); `goPractice()` awaits the
    save before navigating. `broadcastToneChange` / `TONE_CHANGE_EVENT` /
    `newId` are unchanged. No component reads or writes localStorage for app
    data any more (the `FeedbackWidget` survey-dismissal key is the only
    remaining localStorage use, and that's per-browser UI state, not data).
- Usage cap: every Claude-calling route — /api/generate-script,
  /api/practice-feedback, the three `/grill` routes
  (/api/generate-questions, /api/followup-question, /api/qa-feedback), and the
  three interview routes (/api/interview-questions, /api/interview-followup,
  /api/interview-feedback; a full round = 3–7 counted calls) — shares
  the `UsageCounter` row (env: DEMO_REQUEST_LIMIT) via `lib/usageCounter.ts`
  (`recordRequest` does an atomic `upsert … increment`). Durable + roughly
  concurrency-safe now. Check it at GET /api/usage-count (gate with
  USAGE_ADMIN_TOKEN).
- Observability:
  - Sentry init lives in `instrumentation.ts` (+ `sentry.server.config.ts`,
    `sentry.edge.config.ts`) and `instrumentation-client.ts`; `experimental.
    instrumentationHook` is on for Next 14. `app/global-error.tsx` reports React
    render crashes. Frontend catch blocks call `reportClientError()` from
    `lib/clientErrors.ts` (dynamic-imports the SDK, dead-code-eliminated with no
    DSN). API routes call `Sentry.captureException` / `captureMessage` in their
    catch + verification paths, tagged with `route` + request id.
  - All eight Claude routes (`generate-script`, `practice-feedback`, the
    three `/grill` routes, and the three interview routes) emit full-lifecycle structured console logs via
    `lib/logger.ts` (`[<route> <request-id>]` — request received / anthropic
    call started / succeeded|failed / response sent / blocked by cap /
    verification failed). `expert-request` and `script-label` log their own
    lifecycle; `state` and `attempts` log failures only, through the same helper.
  - Before returning, `lib/verifyOutput.ts` checks the feedback has all 5
    required sections (Nonverbal is optional) and the script is
    non-empty/structured, plus the `/grill` equivalents (4 required sections
    for `qa-feedback`; for `generate-questions` and `followup-question`, every
    question must be a complete question ending in "?" and ≤400 chars —
    `cleanQuestion` in `lib/anthropic.ts` deliberately never truncates, so a
    cut-off reply fails here instead of shipping mid-sentence). A failure is logged + sent to Sentry and the route
    returns a graceful 502 (`code: feedback_incomplete` / `script_malformed` /
    `questions_malformed` / `followup_malformed`) rather than partial content.
- Product analytics (PostHog):
  - `lib/analytics.ts` — the only place `posthog-js` is touched. Lazy
    `import()`, no-op unless NEXT_PUBLIC_POSTHOG_KEY is set. `initAnalytics()`,
    `track(event, props)` (props typed to primitives so a script string can't be
    passed), `capturePageview(url)`, and the `EVENTS` name constants. Init sets
    `autocapture: false`, `disable_session_recording: true`,
    `capture_pageview: false` (we send $pageview manually),
    `capture_pageleave: true`, `person_profiles: "identified_only"`.
  - `app/providers.tsx` — `<AnalyticsProvider>` (wraps everything in
    `app/layout.tsx`) boots the SDK and renders `PageviewTracker`, which fires a
    manual `$pageview` on every App Router route change (deduped via a ref for
    StrictMode). This is what gives funnel drop-off between `/generate`,
    `/script`, `/experts`.
  - Named events, all payload = navigation/engagement enums + counts only,
    never content: `script_generated` ({tone}), `script_provided`
    ({tone, method: paste|upload|reused}), `practice_session_started`
    ({tone, source}), `practice_session_completed` ({used_video, duration_sec}),
    `feedback_received` ({used_video, effective_score, effective_band}),
    `expert_request_submitted` (no props), `interview_setup_saved`
    ({panel_size, has_jd, has_background, key_points_count} — fired on Start,
    not per auto-save), `interview_round_started` ({panel_size,
    question_count}), `interview_round_completed` ({answered, followups,
    ended_early, duration_sec}), `interview_feedback_received` (no props).
    Verified end-to-end: seeded secret
    script/PII text never appeared in any outgoing PostHog request.
  - `components/FeedbackWidget.tsx` — one dismissible smiley-rating pattern used
    at every completion point: after a script is generated (`GenerateFlow`),
    after practice coaching is shown (`PracticeSession`), and as a general
    floating pill on `/`. Pick one of 5 faces (frustrated→great, reported as
    1–5) → an optional "Anything you'd like to share?" note → submit. Reports via
    PostHog's `survey sent` (props: `$survey_response`/`rating`, `rating_label`,
    `scale_max`, `has_comment`, `comment`) / `survey dismissed`. Gated on
    `ANALYTICS_ENABLED` (renders nothing without a key); remembers done/dismissed
    per browser in localStorage (`vocalgym:survey:<key>` — keys
    `script_generated_rating`, `practice_feedback_rating`,
    `general_feedback_rating`, `interview_feedback_rating`). Dashboard-created PostHog surveys also render
    since `disable_surveys` is left default.

## Site-wide password gate
- Optional, off by default. `SITE_PASSWORD` unset/blank (the default in
  `.env.local`) fully bypasses it — `middleware.ts` skips the check entirely,
  so local dev behaves exactly as before.
- When set, `middleware.ts` requires a valid `vg_gate` cookie on every
  request; missing/invalid redirects to `/gate?next=<original path>`
  (`/gate` and `/api/gate` are exempted from the check itself, or the
  redirect would loop). `next` is sanitized (`lib/gate.ts`
  `sanitizeNextPath`) to a same-site path only — no open redirect via a
  crafted `?next=`.
- `/gate` (`components/GateForm.tsx`) is a design-system-styled centered
  form (Card/Field/Input/Button primitives, the `lock` icon) that POSTs to
  `POST /api/gate`. On a correct password it sets `vg_gate` — httpOnly,
  `SameSite=lax`, 1-year `Max-Age`, same shape as the `vg_sid` session
  cookie — then does a full-navigation redirect to `next`.
- The cookie never holds the plaintext password: its value is a salted
  SHA-256 digest of `SITE_PASSWORD` (`lib/gate.ts`, via Web Crypto's
  `crypto.subtle` so the same code runs in `middleware.ts`'s Edge runtime
  and the Node API route). Middleware recomputes the expected digest fresh
  from the env var on every request rather than storing anything.
- Unrelated to `USAGE_ADMIN_TOKEN` (that gates a couple of admin endpoints;
  this gates the entire app) — see README.md "Site-wide password gate".

## Quality evals (`evals/`)
- Separate from unit tests — measures AI **output quality**, not correctness.
  Run manually (`npm run eval`, `tsx` devDependency); not wired into CI or any
  schedule. Re-run by hand when `lib/prompt.ts` or `MODEL`
  (`lib/anthropic.ts`) changes. Full docs: README.md "Quality evals".
- `evals/dataset.ts` — 14 realistic situations spanning all 7 tone presets.
- `evals/generateSyntheticAttempt.ts` — a Claude call that synthesizes a
  rehearsal transcript standing in for a human attempt, at `strong` /
  `average` / `weak` delivery quality (deliberately varies filler words,
  on-script vs. rambling, length).
- `evals/run.ts` — for each case, calls the **real** `generateScript()` and
  `generatePracticeFeedback()` (production paths, not mocks) on each
  synthetic attempt; runs transcripts through the real `lib/rubric.ts`
  signal/Effective-score computation (no camera).
- `evals/judge.ts` — a separate Claude call (default `claude-opus-5`,
  deliberately not `MODEL`) scores each feedback response on specificity,
  weakest-area accuracy, and tone appropriateness. Whether a weak attempt's
  Effective score actually came out below a strong one's is checked
  deterministically in `run.ts`, not judged.
- Output: `evals/results/<ISO-timestamp>.json` (gitignored — generated, costs
  API spend to reproduce), stamped with `model` / `judgeModel` /
  `syntheticModel` / `PROMPT_VERSION` (`lib/prompt.ts` — bump it when prompts
  change meaningfully) / git commit, so runs are comparable over time.

## Effectiveness rubric + score
- 8 aspirational attributes (Connected / Present / Smooth / Composed / Warm /
  Confident / Steady / Clear). Each maps to a weighted blend of observable
  signals (eye contact, posture, stillness, expressiveness, composure, volume,
  voice steadiness, fluency, pace) in `lib/rubric.ts`. "Steady" (posture +
  stillness) was named "Grounded" until the `defending` tone preset was added —
  renamed to free up "Grounded" for a future content-accuracy quality; see
  "Open questions" below.
- 7 tone presets (`TONE_RUBRIC_PRESETS` in `lib/rubric.ts`, `Tone` in
  `lib/types.ts`): professional, personal, high-stakes, supportive, persuasive,
  celebratory, and `defending` ("Defending your work" — presenting/proposing
  under expert Q&A or cross-examination, staying composed and precise under
  pushback on a specific claim rather than overclaiming). Adding a tone means
  filling in `TONES`/`TONE_LABELS` (types.ts), `TONE_RUBRIC_PRESETS` (rubric.ts)
  and `TONE_GUIDANCE` (prompt.ts) — the `Record<Tone, …>` types on all three
  make the compiler catch a missed one. The tone dropdowns (`ScriptForm.tsx`,
  `BringScriptFlow.tsx`) just map over `TONES`, so no separate UI wiring.
- The picker on `/` is pre-tuned per tone (`TONE_RUBRIC_PRESETS`) and retunes
  live when the tone changes; editing it flips to a saved custom rubric.
- Each take yields one client-computed **Effective** score (0–100 + band
  label). It's shown on `/practice` and fed into the feedback prompt so the
  coaching targets the highest-weighted quality that scored lowest.

## Open questions
- **Content-scored qualities ("Grounded" = evidence-backed claims, "Precise" =
  exact numbers/definitions when known, honest uncertainty when not).** Wanted
  for the `defending` tone preset (see above) but NOT started — today every
  `RUBRIC_ATTRIBUTES` quality maps only to physical/vocal signals computed
  client-side (`computeSignals` in `lib/rubric.ts`, from audio/MediaPipe/pace),
  and that Effective score is computed *before* the feedback API call and sent
  to Claude as context — Claude narrates a number, it never produces one. Content
  qualities need the reverse: transcript → Claude scores factual grounding →
  score feeds the Effective number. That touches: the model output shape
  (`lib/anthropic.ts`/`lib/prompt.ts` — `generatePracticeFeedback` returns one
  markdown string today; would need a parsed structured score, either a leading
  block like the existing `Title:` line trick in `generateScript`, or a second
  cheap call like `script-label`), `lib/verifyOutput.ts` (validate the new
  score output, 502 gracefully if missing), `lib/types.ts` (`ObservableSignals`
  is specifically signals measurable from audio/video — a new parallel
  server-sourced signal type), `lib/rubric.ts` (`scoreAttribute`/
  `computeEffective` need to merge client- and server-computed signals, which
  they don't today), and `PracticeSession.tsx` (Effective currently renders
  before feedback is fetched — needs either a provisional physical-only score
  that upgrades, or delaying the score until feedback returns). `defending`
  ships now on existing physical/vocal qualities only (`steady` standing in for
  "didn't visibly rattle"); this is tracked as a distinct follow-up feature, not
  a blocker. `/grill` (see Architecture above) is the natural home to start this
  from — its `qa-feedback` prompt already asks Claude to judge "Accuracy vs.
  source" in prose, so turning that into a numeric score is a smaller step than
  starting from `practice-feedback` — but `/grill` v0 still has no
  rubric/Effective-score involvement at all, so this remains unstarted.

## Design system
- Adopted from the "VocalGym Design System" Claude Design project
  (`f8a47408-…`). Warm neutrals (Ink / Charcoal / Fog / Parchment / Canvas),
  ONE accent (Ember `#A9723A`; use `--ember-text` `#8A5A28` for accent copy),
  no feature colors. Serif (Source Serif 4) only for moments of address —
  page/section titles, hero lines; Public Sans for body + all UI, incl. H4
  section labels. Recording state is the one "hot" signal (`--live` `#8C3A2B`).
- **Tokens** live in `app/styles/tokens.css` (CSS custom properties, imported
  at the top of `app/globals.css`) and are mapped onto Tailwind utilities in
  `tailwind.config.ts` — `bg-canvas`, `text-text-body`, `rounded-card`,
  `shadow-sm`, `font-serif`, `text-h2`, `max-w-prose`, `ease-settle`, etc.
- **Primitives** in `components/ui/` (barrel `index.ts`) are faithful TS ports
  of the DS's own components: Button, IconButton, Icon, Card, Badge, Tag,
  BrandMark, Waveform, Field, Input, Textarea, Select, Checkbox, Radio, Switch,
  Tabs + a token-built `Callout` (amber/red notice boxes). They style
  themselves from the CSS vars via inline `style={{…}}` + React hover/press
  state — screen-level layout glue uses the Tailwind token utilities. Button
  and Card take an `as` / `href` escape hatch for link CTAs. Dialog / Toast /
  Tooltip / SidebarNav exist in the DS but aren't ported (nothing uses them).
- **Icons**: `Icon` renders `lucide-react` from an explicit ~35-glyph allow-list
  (`components/ui/Icon.tsx` REGISTRY) — a wildcard import balloons the bundle
  ~200kB. Add a glyph to REGISTRY when genuinely needed.
- **Fonts**: `next/font/google` in `app/layout.tsx` sets `--font-source-serif` /
  `--font-public-sans`, consumed by `tokens.css`.
- **Logo**: `<BrandMark>` references `/public/brand/logo-*.png`. Those PNGs
  exceed the design-tool read cap and must be exported from the DS project
  manually — until then `SiteHeader` shows a plain-text "VocalGym" wordmark.
- Layout / IA unchanged: kept the top-nav `SiteHeader`, did NOT adopt the DS's
  sidebar `AppShell` or full-Ink rehearsal room (that would be a feature change).
- `FeedbackWidget` keeps its emoji smiley faces (a shipped feature) even though
  the DS says "Emoji: never" — only its chrome is tokenised.

## Conventions
- Keep features additive/isolated — new features get their own route/module,
  don't modify working existing flows unless explicitly asked
- `npm run dev`'s `predev` hook (`scripts/devCacheGuard.mjs`) clears `.next`
  whenever HEAD has moved since the last `npm run dev` — a `next dev` process
  left running across a branch switch/merge/rebase can serve a stale build
  cache whose CSS/JS manifest no longer matches disk (symptom: a fully
  unstyled page). No-op on the normal edit-save-reload loop. See README.md
  "Getting started".
- Style with the design system: `components/ui/` primitives + the token
  Tailwind utilities. Don't hand-roll `bg-slate-*` / `rounded-xl border`
  card/button/input markup — a primitive already covers it. No feature colors;
  amber/red notices are `<Callout tone="caution"/"critical">`.
- .env.local (gitignored, never commit) holds ANTHROPIC_API_KEY,
  DATABASE_URL / DATABASE_URL_POOLED, and SITE_PASSWORD (secret) plus
  NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST
  and DEMO_REQUEST_LIMIT (not secret); all documented in .env.example. The two DATABASE_* vars are ALSO kept
  in `.env` (gitignored) because the Prisma CLI reads only `.env`; keep the two
  files in sync.
- Server DB access goes through the `prisma` singleton in `lib/prisma.ts` — never
  `new PrismaClient()` in a route/module. Runtime queries hit the pooled
  connection automatically (schema `url`). Schema changes: edit
  `prisma/schema.prisma`, then `npm run db:migrate -- --name <change>` (uses the
  direct `DATABASE_URL`); commit the generated `prisma/migrations/` folder.
- Per-session data (script / rubric / attempts) is read/written only through
  `lib/practiceStore.ts` on the client and `lib/sessionState.server.ts` on the
  server. Don't reach for localStorage for anything that should survive a device
  change — it's gone for app data.
- Pure logic lives in `lib/*` (no React, safe on server); browser-only libs
  (MediaPipe, pdf.js, Sentry client, posthog-js) are dynamically imported so
  they stay out of the main bundle
- Analytics is navigation/engagement only. Never pass script text, transcript
  content, feedback text, or PII (name/email/situation) to `track()` — its props
  are typed to primitives; keep it that way. New events go through
  `lib/analytics.ts` `EVENTS`.
- New model-output paths should route through `lib/verifyOutput.ts` and the
  route logger rather than trusting the response shape
- Feedback sections format: Overall / What landed / Gaps vs. the script /
  Delivery / Nonverbal (only when webcam signals are present) /
  For your next take

## Not yet built (known future work)
- Auth/accounts — data is scoped to an anonymous `vg_sid` cookie; clearing
  cookies or switching browsers starts fresh. Real accounts would attach these
  `Session` rows to a user.
- `prisma migrate deploy` in the deploy pipeline (there's a `db:deploy` script
  but no CI/host wired to run it).
- Export the 8 brand logo PNGs from the DS project into `public/brand/` and
  switch `SiteHeader` (+ footer / hero) from the text wordmark to `<BrandMark>`.
- Sentry source-map upload — the `next.config.mjs` wiring is in place; just
  needs SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN provided (in `.env.local`
  for a local prod build, or as host/CI secrets) to start uploading on
  `next build`.
- Presentation mode (`/prep` card is "Coming soon"): speaker notes /
  talking points as context → deliver the talk → feedback on coverage of each
  point + delivery. Closer in shape to `/practice` than to the interview flow.
- Interview rounds (`/prep/interview`) aren't persisted — no round history,
  no resume after refresh; the camera signal is unused there too.
- `/grill` v0 is a prototype, not a finished feature: no link from `/` or
  `SiteHeader` yet (direct URL only), no persistence (no `Attempt` history, no
  resume on refresh), not instrumented with PostHog events, and the recorder's
  camera toggle works but its signal isn't used by the feedback call. See
  Architecture above and "Open questions" for the content-scored-quality
  follow-up it's meant to lead into.

## Maintenance
- After completing a feature or meaningful architectural change, update this
  CLAUDE.md file to reflect the new state (architecture, tech stack,
  "not yet built" list) before considering the task done.

