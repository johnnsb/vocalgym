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
- Sentry (@sentry/nextjs v10) for error tracking — gated on
  NEXT_PUBLIC_SENTRY_DSN (blank = fully disabled, zero client-bundle cost;
  `next.config.mjs` only wires in `withSentryConfig` when the DSN is set). A DSN
  is currently configured in .env.local, so it's active — including in
  `npm run dev` (events tagged `environment: development`). No source-map upload
  configured.
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
  Both `/script` and `/generate` also render the effectiveness rubric picker.
- `/practice` — practice session: record audio (+ optional video), transcribe,
  submit to POST /api/practice-feedback for Claude-generated coaching notes.
  Camera frames never leave the browser — only the derived metric summary and
  the Effective score are sent. The rubric strip's "change" does `router.back()`.
- Persistence: **Postgres via Prisma**, scoped to an anonymous session.
  - Identity: `middleware.ts` ensures every request carries a `vg_sid` httpOnly
    cookie (random UUID) and forwards it to route handlers via an `x-vg-sid`
    request header. `lib/session.ts` `getSessionId()` reads it; `ensureSession()`
    upserts the `Session` row. No accounts yet — the cookie *is* the user.
  - Models (`prisma/schema.prisma`): `Session` (1 per browser; `currentScript`
    and `rubric` are `Json?` blobs — StoredScript / RubricSelection shapes),
    `Attempt` (FK → Session, cascade; newest 50/session kept), `ExpertRequest`,
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
    counted against the demo cap).
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
- Usage cap: /api/generate-script and /api/practice-feedback share the
  `UsageCounter` row (env: DEMO_REQUEST_LIMIT) via `lib/usageCounter.ts`
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
  - The two Claude routes emit full-lifecycle structured console logs via
    `lib/logger.ts` (`[<route> <request-id>]` — request received / anthropic
    call started / succeeded|failed / response sent / blocked by cap /
    verification failed). `expert-request` and `script-label` log their own
    lifecycle; `state` and `attempts` log failures only, through the same helper.
  - Before returning, `lib/verifyOutput.ts` checks the feedback has all 5
    required sections (Nonverbal is optional) and the script is
    non-empty/structured. A failure is logged + sent to Sentry and the route
    returns a graceful 502 (`code: feedback_incomplete` / `script_malformed`)
    rather than partial content.
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
    `expert_request_submitted` (no props). Verified end-to-end: seeded secret
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
    `general_feedback_rating`). Dashboard-created PostHog surveys also render
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
- `evals/dataset.ts` — 13 realistic situations spanning all 6 tone presets.
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
  Confident / Grounded / Clear). Each maps to a weighted blend of observable
  signals (eye contact, posture, stillness, expressiveness, composure, volume,
  voice steadiness, fluency, pace) in `lib/rubric.ts`.
- The picker on `/` is pre-tuned per tone (`TONE_RUBRIC_PRESETS`) and retunes
  live when the tone changes; editing it flips to a saved custom rubric.
- Each take yields one client-computed **Effective** score (0–100 + band
  label). It's shown on `/practice` and fed into the feedback prompt so the
  coaching targets the highest-weighted quality that scored lowest.

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
- Sentry source-map upload (set SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
  and drop `sourcemaps.disable` in `next.config.mjs` for readable stack traces)

## Maintenance
- After completing a feature or meaningful architectural change, update this
  CLAUDE.md file to reflect the new state (architecture, tech stack,
  "not yet built" list) before considering the task done.

