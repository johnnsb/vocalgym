# VocalGym

AI-assisted communication practice platform. Users describe a difficult
situation, get an AI-generated script (or upload their own), then practice
delivering it and receive feedback on content, vocal delivery, and nonverbal
signals — rolled up into a single "Effective" score.

The route-by-route architecture tour lives in README.md ("Project structure"
and the per-feature sections). This file keeps only what the code can't tell
you: gotchas, rationale, and rules.

## Stack gotchas
- Prisma 6 against Neon Postgres: runtime uses the pooled connection
  (`DATABASE_URL_POOLED`, `?pgbouncer=true`); migrations use the direct
  `DATABASE_URL`. The Prisma CLI reads only `.env`, so both `DATABASE_*` vars
  live in `.env` AND `.env.local` — keep them in sync. Postgres is the source
  of truth for all app data; localStorage is no longer used for it.
- Hosting: Vercel (chosen over Cloud Run for zero-config Next; keep the code
  host-agnostic so a later move is just a Dockerfile). `npm run build` runs
  `prisma migrate deploy`, so ANY build migrates the DB in `DATABASE_URL` —
  only Production has the Neon `production` branch's strings; Preview has no
  DB vars (preview builds fail by design). Never point Preview at production. Vercel
  Hobby is non-commercial only — move to Pro before charging users.
- Models: `MODEL = claude-sonnet-5` and `LABEL_MODEL =
  claude-haiku-4-5-20251001` (script titles) in `lib/anthropic.ts`.
- MediaPipe (Face/Pose Landmarker) runs client-side, lazy-loaded only when the
  camera is enabled. Chosen over Hume / Google Video Intelligence for now;
  those are candidates for a later paid upgrade once the UX is validated.
- Vitest is pinned to v3 because v5 peer-requires `@types/node` ≥22 and the
  repo is on 20. Unit tests cover pure `lib/` logic only (`lib/**/*.test.ts`);
  UI flows are verified manually in the browser.
- ESLint is pinned to v8 (`.eslintrc.json`, `next/core-web-vitals`) because
  Next 14's `next lint` doesn't support v9.
- npm 11 `allowScripts` in `package.json`: entries are pinned to exact
  versions, so upgrading Prisma / esbuild / `@sentry/cli` means re-running
  `npm install-scripts approve <pkg>` — otherwise Prisma silently stops
  generating its client on install.
- Use nvm's arm64 Node v24. An Intel Homebrew Node v26 in `/usr/local` (now
  unlinked) made npm install x64 native packages (`@rollup/rollup-darwin-x64`
  missing → `npm test` crashed).
- tsconfig has no `target`, so spreading iterators (`[...map.entries()]`,
  `[...str.matchAll()]`) fails `tsc` — use `Array.from(...)`.
- Sentry is gated on `NEXT_PUBLIC_SENTRY_DSN` (blank = fully disabled, zero
  bundle cost). A DSN IS set in `.env.local`, so it's active in `npm run dev`
  too (`environment: development`). Source-map upload needs SENTRY_ORG +
  SENTRY_PROJECT + SENTRY_AUTH_TOKEN all set. Production `.map` files return
  403 (confirmed in the Oct 16 production check). **Still unverified:** whether
  the plugin deletes the generated `.map` files after upload — check build
  output the first time a real token is set.
- PostHog is gated on `NEXT_PUBLIC_POSTHOG_KEY` (blank = SDK never imported).
  A key IS set in `.env.local`, so analytics and the `FeedbackWidget` prompts
  are LIVE in dev. Autocapture, session recording and anonymous person
  profiles are deliberately off.

## Data-safety and correctness gotchas
- Identity is the anonymous `vg_sid` httpOnly cookie (set by `middleware.ts`,
  forwarded as `x-vg-sid`). No accounts — the cookie *is* the user.
- Prep auto-save (interview + presentation setup): saves are debounced ~800ms,
  only fire when the form differs from the last-saved snapshot, and are
  flushed on leave with `fetch(…, { keepalive: true })` (presentation: only
  under ~60KB — `keepaliveSafe`). `shouldPersist` blocks every save until the
  saved data has LOADED successfully (GET retries once), so a blank form after
  a failed load or a StrictMode dev remount can never overwrite real data.
  Setup loads ignore a superseded StrictMode load via a `cancelled` flag.
- Interview: `recordAnswer` is used by Continue AND "End early" so an answer
  on screen is never dropped; a follow-up shown but never answered is dropped
  by `normalizeExchanges`. Over-limit text is truncated, never rejected. A
  malformed follow-up returns `{ followUp: null }` (200) so a round never
  stalls. The plan prompt never asks about a key point by name.
- Presentation: takes are stored in `PresentationTake`, NEVER `Attempt`, so
  `/practice` history is unaffected; saved only after feedback succeeds.
  `.pptx` slide order comes from `ppt/presentation.xml` `sldIdLst`, never file
  names. Per-slide timing can be ~0.5s off. Audience Q&A (opt-in
  `audienceQa`): unanswered questions are dropped; only answered pairs go to
  feedback, which requires the **Q&A** section only then
  (`verifyPresentationFeedback(text, { hasQa })`). If feedback fails after
  Q&A, the user stays on the feedback screen with a retry (`lastQa`) instead
  of being sent back through the questions.
- Prompt tags: every piece of user (or model-echoed) text placed inside one of
  the XML-style prompt tags goes through `tagText` (`lib/prompt.ts`), which
  escapes only a tag-shaped `<` — so pasted notes can't close `</notes>`, and
  "R&D" / "a < b" reach the model untouched. New tagged fields must use it
  (`lib/prompt.escaping.test.ts` counts closing tags per builder).
- Script ids: `patchState` keeps `currentScript.id` stable while the text is
  unchanged and mints a new UUID when it changes; attempts copy `scriptId` /
  `scriptLabel` so history groups by script.
- Output verification: interview and presentation feedback checks accept only
  bold or `#`/`##` headings (`SECTION_HEAD`), so a `### <question>`
  subheading can't satisfy a missing section. `cleanQuestion` deliberately
  never truncates, so a cut-off model reply fails verification instead of
  shipping mid-sentence. Failures → log + Sentry + graceful 502 with a `code`.
- `lib/claudeRoute.ts` is used by the interview and presentation routes, and
  `lib/clientFetch.ts` by `InterviewSession` and `PresentationSession`; the
  older routes (including `/grill`) keep inline copies.
- Every Claude-calling route counts against the shared `UsageCounter`
  (`DEMO_REQUEST_LIMIT`, `lib/usageCounter.ts`) — new Claude routes must too.
  `/api/script-label` is the one exception (best-effort, not counted).
- Site password gate (`SITE_PASSWORD`, blank = off): `next` is sanitized to a
  same-site path (`sanitizeNextPath`) — no open redirect. The cookie holds a
  salted SHA-256 digest via Web Crypto (runs in Edge and Node), never the
  password. Unrelated to `USAGE_ADMIN_TOKEN`.

## Product scope decisions
- `/prep` hub is reached ONLY from the strip under the three landing cards —
  deliberately kept out of the main flow and nav. Grow it rather than cloning
  flows. `/grill` is linked only from `/prep`.
- `/experts` is NOT an AI feature — a contact form fulfilled manually.
- Deliberately unfinished (v0): `/grill` and interview rounds have no
  persistence, no rubric/Effective score, and their camera signal is unused;
  `/grill` isn't wired to PostHog. Presentation v1 has no drill-one-slide
  mode, numeric coverage score, or slide images; its audience Q&A is exactly
  2 questions with no follow-ups (YAGNI — see
  `docs/superpowers/specs/2026-10-03-presentation-qa-design.md`).
- `FeedbackWidget` keeps its emoji faces (a shipped feature) even though the
  design system says "Emoji: never".
- Interviewer profiles, notes, slides, audiences and transcripts are
  third-party/user content: never sent to PostHog, never previewed in logs.

## Effectiveness rubric + score
- 8 attributes (Connected / Present / Smooth / Composed / Warm / Confident /
  Steady / Clear), each a weighted blend of observable signals in
  `lib/rubric.ts`. "Steady" was named "Grounded" until the `defending` tone was
  added — renamed to free "Grounded" for a future content-accuracy quality.
- Adding a tone means filling `TONES`/`TONE_LABELS` (types.ts),
  `TONE_RUBRIC_PRESETS` (rubric.ts) and `TONE_GUIDANCE` (prompt.ts); the
  `Record<Tone, …>` types make the compiler catch a missed one.
- `PRESENTATION_RUBRIC` is deliberately NOT a `Tone`, so the tone dropdowns
  stay unchanged.
- The Effective score is computed client-side BEFORE the feedback call and sent
  to Claude as context — Claude narrates the number, it never produces one.

## Open questions
- **Content-scored qualities ("Grounded" = evidence-backed claims, "Precise" =
  exact numbers when known, honest uncertainty when not).** Wanted for the
  `defending` tone, NOT started. Needs the reverse of today's flow: transcript →
  Claude scores grounding → score feeds Effective. Touches the model output
  shape (`lib/anthropic.ts`/`lib/prompt.ts` — a leading block like the `Title:`
  trick in `generateScript`, or a second cheap call like `script-label`),
  `lib/verifyOutput.ts`, `lib/types.ts` (`ObservableSignals` is audio/video
  only — needs a parallel server-sourced signal type), `lib/rubric.ts`
  (`scoreAttribute`/`computeEffective` must merge client + server signals), and
  `PracticeSession.tsx` (Effective renders before feedback — needs a
  provisional score that upgrades, or a delayed score). `/grill` is the natural
  starting point (its `qa-feedback` already judges "Accuracy vs. source" in
  prose), but it has no rubric involvement yet.

## Design system
- Ported from the "VocalGym Design System" Claude Design project
  (`f8a47408-…`). Warm neutrals, ONE accent (Ember `#A9723A`; use
  `--ember-text` `#8A5A28` for accent copy), no feature colors. Serif (Source
  Serif 4) only for moments of address — page/section titles, hero lines;
  Public Sans for body + all UI, incl. H4 section labels. Recording state is
  the one "hot" signal (`--live` `#8C3A2B`).
- Tokens: `app/styles/tokens.css`, mapped to Tailwind utilities in
  `tailwind.config.ts`. Primitives in `components/ui/` style themselves from
  CSS vars via inline styles; screen-level layout uses the token utilities.
- `Icon` uses an explicit lucide allow-list (`components/ui/Icon.tsx`
  REGISTRY) — a wildcard import adds ~200kB. Add glyphs there when needed.
- Kept the top-nav `SiteHeader`; did NOT adopt the DS's sidebar `AppShell` or
  full-Ink rehearsal room (that would be a feature change).

## Conventions
- Keep features additive/isolated — new features get their own route/module;
  don't modify working existing flows unless explicitly asked.
- `npm run dev`'s `predev` hook (`scripts/devCacheGuard.mjs`) clears `.next`
  when HEAD has moved since the last dev run — a stale cache after a branch
  switch shows up as a fully unstyled page.
- Style with the design system: `components/ui/` primitives + token Tailwind
  utilities. Don't hand-roll `bg-slate-*` / `rounded-xl border` markup. Notices
  are `<Callout tone="caution"/"critical">`.
- `.env.local` (gitignored, never commit) holds the secrets
  (ANTHROPIC_API_KEY, DATABASE_URL(_POOLED), SITE_PASSWORD) plus the
  non-secret NEXT_PUBLIC_* / DEMO_REQUEST_LIMIT vars; all documented in
  `.env.example`.
- Server DB access goes through the `prisma` singleton in `lib/prisma.ts` —
  never `new PrismaClient()`. Schema change: edit `prisma/schema.prisma`, then
  `npm run db:migrate -- --name <change>`; commit `prisma/migrations/`.
- Per-session data is read/written only through `lib/practiceStore.ts`
  (client) and `lib/sessionState.server.ts` (server), which validates every
  untrusted blob. No localStorage for app data (the `FeedbackWidget`
  dismissal key is the only use).
- Pure logic lives in `lib/*` (no React, server-safe); browser-only libs
  (MediaPipe, pdf.js, fflate, Sentry client, posthog-js) are dynamically
  imported to stay out of the main bundle.
- Analytics is navigation/engagement only. Never pass script text, transcript
  content, feedback text, or PII to `track()` — its props are typed to
  primitives; keep it that way. New events go through `lib/analytics.ts`
  `EVENTS`.
- New model-output paths must route through `lib/verifyOutput.ts` and the
  route logger (`lib/logger.ts`) rather than trusting the response shape.
- Practice feedback sections: Overall / What landed / Gaps vs. the script /
  Delivery / Nonverbal (only with webcam signals) / For your next take.
- AI quality evals (`evals/`, `npm run eval`) are separate from unit tests —
  see the `run-evals` skill.

## Not yet built (known future work)
- Auth/accounts — data is scoped to the anonymous `vg_sid` cookie.
- Export the 8 brand logo PNGs from the DS project into `public/brand/` (they
  exceed the design-tool read cap) and switch `SiteHeader` from the text
  wordmark to `<BrandMark>`.
- Sentry source-map upload — wiring done; needs the three SENTRY_* values.
- Presentation follow-ups: drill-one-slide, numeric coverage score. Known
  rough edge: feedback checks accept a bullet-prefixed heading and reject
  `###` headings.
- Interview rounds and `/grill` aren't persisted (no history, no resume).

## Maintenance
- After completing a feature or meaningful architectural change, update this
  file (gotchas, decisions, "not yet built") and README.md (the architecture
  tour) before considering the task done.
