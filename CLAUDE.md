# VocalGym

AI-assisted communication practice platform. Users describe a difficult
situation, get an AI-generated script (or upload their own), then practice
delivering it and receive feedback on content, vocal delivery, and nonverbal
signals — rolled up into a single "Effective" score.

## Tech stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Anthropic API (Claude Sonnet 5 default) for script generation and feedback
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
  `https://us.i.posthog.com`). Currently blank in .env.local, so it's off.
  Navigation + named interaction events ONLY — autocapture, session recording,
  and anonymous person profiles are all disabled; script/transcript/feedback
  text is never sent (see Observability below).

## Architecture
- `/` — landing page: nav (shared `SiteHeader` in `app/layout.tsx`), tagline,
  and three path cards that branch the old combined form:
  - `/script` (`BringScriptFlow`) — "I know what I want to say". If a script is
    already in localStorage it's shown with "use as-is" / "write my own"; if not,
    a plain paste box (+ upload .txt/.md/.pdf, parsed in the browser) → tone →
    "Continue to practice". source = "uploaded".
  - `/generate` (`GenerateFlow`) — "help me find the words": situation + tone →
    POST /api/generate-script → `ScriptResult`. source = "generated".
  - `/experts` (`ExpertRequestForm`) — NOT an AI feature. A contact form
    (situation + name + email) → POST /api/expert-request, which appends to a
    file-backed store (`lib/expertRequests.ts`) and logs it. Confirmation
    message shown; requests are fulfilled manually via `/admin/requests`
    (token-gated by USAGE_ADMIN_TOKEN when set) or GET /api/expert-request.
  - `/faq`, `/signin` — thin "coming soon" stub pages.
  Both `/script` and `/generate` also render the effectiveness rubric picker.
- `/practice` — practice session: record audio (+ optional video), transcribe,
  submit to POST /api/practice-feedback for Claude-generated coaching notes.
  Camera frames never leave the browser — only the derived metric summary and
  the Effective score are sent. The rubric strip's "change" does `router.back()`.
- No database yet. Scripts, the rubric selection, and past practice attempts
  persist in localStorage only (keys: `vocalgym:current-script` — includes a
  `source` field, `vocalgym:rubric`, `vocalgym:attempts` — attempts capped at
  50). Entry-page form/script state is restored from localStorage across
  navigation (each flow only restores its own `source`). No auth/accounts yet.
- Usage cap: /api/generate-script and /api/practice-feedback share a
  persistent file-backed request counter (env: DEMO_REQUEST_LIMIT) to protect
  against cost from a shared demo link. Check it at GET /api/usage-count
  (gate with USAGE_ADMIN_TOKEN); see README "Demo usage cap" to reset.
- Observability:
  - Sentry init lives in `instrumentation.ts` (+ `sentry.server.config.ts`,
    `sentry.edge.config.ts`) and `instrumentation-client.ts`; `experimental.
    instrumentationHook` is on for Next 14. `app/global-error.tsx` reports React
    render crashes. Frontend catch blocks call `reportClientError()` from
    `lib/clientErrors.ts` (dynamic-imports the SDK, dead-code-eliminated with no
    DSN). API routes call `Sentry.captureException` / `captureMessage` in their
    catch + verification paths, tagged with `route` + request id.
  - Both API routes emit structured console logs via `lib/logger.ts`
    (`[<route> <request-id>]` — request received / anthropic call started /
    succeeded|failed / response sent / blocked by cap / verification failed).
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
  - `components/FeedbackWidget.tsx` — dismissible survey widget reporting via
    PostHog's `survey sent` / `survey dismissed` events. `variant="inline"` is
    shown on `/practice` after coaching notes ("Was this feedback helpful?");
    `variant="floating"` is a corner pill on `/` (general feedback). Renders
    nothing when analytics is disabled; remembers dismissal in localStorage
    (`vocalgym:survey:<key>`). Dashboard-created PostHog surveys also render
    since `disable_surveys` is left default.

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

## Conventions
- Keep features additive/isolated — new features get their own route/module,
  don't modify working existing flows unless explicitly asked
- .env.local (gitignored, never commit) holds ANTHROPIC_API_KEY (secret) plus
  NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST and
  DEMO_REQUEST_LIMIT (not secret); all documented in .env.example
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
- Auth/accounts, real database (currently localStorage only)
- Brand/design system pass (planned via Claude Design, not yet started)
- Hosted persistence for the usage counter on serverless (file counter isn't
  durable across Vercel cold starts — see `lib/usageCounter.ts`)
- Sentry source-map upload (set SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
  and drop `sourcemaps.disable` in `next.config.mjs` for readable stack traces)

## Maintenance
- After completing a feature or meaningful architectural change, update this
  CLAUDE.md file to reflect the new state (architecture, tech stack,
  "not yet built" list) before considering the task done.
