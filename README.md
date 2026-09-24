# VocalGym

Practice for the conversations that matter. The landing page (`/`) branches into
three paths: **bring your own words** (`/script` — paste or upload a `.txt` /
`.md` / `.pdf`), **have us write them** (`/generate` — describe the situation,
pick an optional tone, get a script), or **get expert guidance** (`/experts` — a
contact form; a human follows up with a tailored script). The first two lead
straight to the rehearsal step.

Then open **Practice**: record yourself running the script, review the
speech-to-text transcript, and get coaching notes from Claude on what landed and
what to tighten. Optionally turn on your camera for a rough read on eye contact,
posture, and expressiveness — analyzed in the browser with MediaPipe, so only the
summary numbers are ever sent. Your current script, rubric, and past attempts are
saved server-side in Postgres, scoped to an anonymous per-browser session cookie
(no accounts yet).

On the script-setup pages (`/generate`, `/script`), "what does *effective* mean here?" is pre-tuned to the
tone/context you picked (a *high-stakes* talk is scored mostly on staying
composed and clear; a *personal* one on staying connected and warm; and so on).
Adjust the qualities or weights and it becomes your own custom rubric. Each take
gets one **Effective** score (0–100) rolled up from the measurable signals behind
those qualities, and the coaching targets the quality weighted highest that
scored lowest.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, the Anthropic SDK,
Prisma + Postgres, and MediaPipe Tasks Vision. The UI runs on a warm, single-
accent design system (`components/ui/` + `app/styles/tokens.css`) ported from a
Claude Design project — see **Design system** below.

## Getting started

1. Clone and install:

   ```bash
   git clone https://github.com/johnnsb/vocalgym.git
   cd vocalgym
   npm install
   ```

2. Add your Anthropic API key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
   ```

   Create a key at <https://console.anthropic.com/settings/keys>.

3. Point it at a Postgres database (the app stores your script, rubric, and
   attempts there):

   ```bash
   # in BOTH .env and .env.local (the Prisma CLI only reads .env):
   #   DATABASE_URL=<direct connection string>
   #   DATABASE_URL_POOLED=<pooled connection string>   # ?pgbouncer=true for PgBouncer/Neon
   npm run db:deploy      # apply migrations to the database
   ```

   Any Postgres works; Neon is what this repo is set up against. See
   **Database** below.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

   `npm run dev` auto-clears the `.next` build cache whenever the git commit
   has changed since the last time you ran it (`predev` ->
   `scripts/devCacheGuard.mjs`) — a `next dev` process that stays running
   across a branch switch/merge/rebase/pull can end up serving a stale cache
   whose asset manifest no longer matches what's on disk (symptom: the page
   loads with zero CSS applied). The guard makes that a non-issue; it's a
   no-op on the normal edit-save-reload loop. If you ever still hit an
   unstyled page, the manual fix is `rm -rf .next && npm run dev`.

## Project structure

```
instrumentation.ts                 Sentry server/edge init (Next 14 hook)
instrumentation-client.ts          Sentry browser init
sentry.server.config.ts            \
sentry.edge.config.ts               } Sentry.init() per runtime (no-op without DSN)
middleware.ts                      Ensures the anonymous `vg_sid` cookie + the `vg_gate` password-gate check
prisma/
  schema.prisma                    Session / Attempt / ExpertRequest / UsageCounter
  migrations/                      Committed SQL migrations (prisma migrate)
app/
  api/generate-script/route.ts     POST -> { script, label } from one Claude call
  api/script-label/route.ts        POST -> { label } (Haiku) for brought-your-own scripts
  api/practice-feedback/route.ts   POST endpoint: transcript + script -> coaching
  api/generate-questions/route.ts  "grill" v0: POST source text -> { questions } (numbered list)
  api/followup-question/route.ts   "grill" v0: POST question+transcript+source -> { followUp }
  api/qa-feedback/route.ts         "grill" v0: POST source+exchanges -> { feedback } (no rubric)
  api/state/route.ts               GET session state (script+rubric+attempts); PATCH to update
  api/attempts/route.ts            POST save an attempt; DELETE clear all
  api/attempts/[id]/route.ts       DELETE one attempt (session-scoped)
  api/usage-count/route.ts         GET the demo counter (see "Demo usage cap")
  api/expert-request/route.ts      POST save an expert-help request; GET lists them
  api/gate/route.ts                POST { password } -> sets the vg_gate cookie or 401s
  gate/page.tsx                    Password-gate form (see "Site-wide password gate")
  global-error.tsx                 Catches React render crashes -> Sentry
  layout.tsx                       Root layout (+ SiteHeader nav, AnalyticsProvider)
  providers.tsx                    Client analytics bootstrap + route-change $pageview
  page.tsx                         Landing page (tagline + 3 path cards)
  generate/page.tsx                "Help me find the words" — GenerateFlow
  script/page.tsx                  "Bring your own words" — BringScriptFlow
  experts/page.tsx                 "Get expert help" — ExpertRequestForm (no AI)
  admin/requests/page.tsx          Read submitted expert requests (token-gated)
  how-it-works/page.tsx            Stub content page (the 3-step loop)
  faq/page.tsx                     Stub FAQ (a few real short answers)
  signin/page.tsx                  Thin "coming soon" stub
  practice/page.tsx                Practice route
  grill/page.tsx                   "Defend your work" v0 — GrillSession (no nav link yet, direct URL only)
  globals.css                      Imports styles/tokens.css, then Tailwind
  styles/tokens.css                Design-system tokens (CSS custom properties)
components/
  ui/                              Design-system primitives (Button, Card, Field, Icon, …) + Callout
  SiteHeader.tsx                   Top nav (wordmark, How it works, FAQ, Sign in)
  GenerateFlow.tsx                 AI-generate path: form + result + state restore
  BringScriptFlow.tsx              Bring-your-own path: use existing / paste / upload
  ExpertRequestForm.tsx            Expert-help contact form + confirmation
  GateForm.tsx                     Password-gate form, posts to /api/gate
  ScriptForm.tsx                   Situation textarea + quick-start examples + tone
  ScriptResult.tsx                 Rendered script with copy / regenerate / practice
  RubricPicker.tsx                 Tone-tuned "effective" qualities, editable
  PracticeSession.tsx              Practice orchestrator: script, record, feedback, history
  PracticeRecorder.tsx             Mic + optional camera capture; drives the samplers
  PracticeFeedback.tsx             Rendered coaching notes
  FeedbackSections.tsx             Parses feedback markdown into icon-labelled sections
  NonverbalSummary.tsx             Compact eye-contact / posture / expressiveness chips
  EffectiveScore.tsx               The Effective score + per-attribute breakdown bars
  PastAttempts.tsx                 Sidebar history, grouped by script (label header), rows collapsible
  FeedbackWidget.tsx               Dismissible smiley-rating PostHog survey (generate / practice / landing)
  GrillSession.tsx                 "grill" v0 orchestrator: upload -> questions -> record -> follow-up -> record -> feedback
  QAFeedbackSections.tsx           Parses grill feedback markdown (own section set, not FeedbackSections)
lib/
  anthropic.ts                     Anthropic client + generateScript() / generatePracticeFeedback() / generateScriptLabel() / generateQuestions() / generateFollowUpQuestion() / generateQAFeedback()
  prompt.ts                        System prompts + prompt builders
  types.ts                         Shared types (tones, metrics, rubric, signals, score, grill Q&A types)
  practiceStore.ts                 Client fetch wrapper over /api/state + /api/attempts
  session.ts                       getSessionId() / ensureSession() — reads the vg_sid cookie
  gate.ts                          Site-password-gate logic — vg_gate cookie digest, next-path sanitizing
  sessionState.server.ts           Server data layer: get/patch state, add/remove/clear attempts
  nonverbal.ts                     Pure: summarize webcam samples, sanitize, format for prompt
  mediapipe.ts                     NonverbalAnalyzer — lazy-loads MediaPipe, one frame -> metrics
  audioMeter.ts                    Web Audio RMS meter -> rough volume / steadiness summary
  rubric.ts                        Pure: attribute->signal rubric, signal + Effective computation
  usageCounter.ts                  Demo request cap — atomic counter in the UsageCounter row
  scriptImport.ts                  Extract text from an uploaded .txt / .md / .pdf (pdf.js)
  logger.ts                        Structured console logging for the API routes
  verifyOutput.ts                  Shape checks on model output before it's returned
  clientErrors.ts                  Lazy Sentry capture for the frontend (DSN-gated)
  analytics.ts                     Lazy PostHog wrapper: track() / pageviews / EVENTS (key-gated)
  expertRequests.ts                ExpertRequest table access for "get expert help"
  prisma.ts                        Shared PrismaClient singleton (HMR-safe); pooled at runtime
evals/                             Quality evals (npm run eval) — see "Quality evals" below
  dataset.ts                       14 test situations spanning all 7 tone presets
  client.ts                        Shared Anthropic client for eval-only calls (synthetic + judge)
  generateSyntheticAttempt.ts      Synthesizes strong/average/weak rehearsal transcripts
  judge.ts                         LLM judge — scores feedback on specificity/weakest-area/tone
  run.ts                           Runner: calls the real generateScript/generatePracticeFeedback
  results/                         Gitignored timestamped JSON output
```

## Configuration

- **Model** — set in `lib/anthropic.ts` (`MODEL`). Currently `claude-sonnet-5`.
- **API key** — read from `ANTHROPIC_API_KEY` at request time. Never hardcoded.

## Design system

Ported from a Claude Design project (`f8a47408-…`). A warm neutral palette
(Ink / Charcoal / Fog / Parchment / Canvas) with a **single** Ember accent — no
feature colors. Source Serif 4 for headlines / moments of address, Public Sans
for body and all UI. The recording state is the one "hot" signal (`--live`).

- **Tokens** — `app/styles/tokens.css` (CSS custom properties), `@import`ed at
  the top of `app/globals.css` and mapped onto Tailwind utilities in
  `tailwind.config.ts`: `bg-canvas`, `text-text-body`, `rounded-card`,
  `shadow-sm`, `font-serif`, `text-h2`, `max-w-prose`, `ease-settle`, …
- **Primitives** — `components/ui/` (barrel `index.ts`): Button, IconButton,
  Icon, Card, Badge, Tag, BrandMark, Waveform, Field, Input, Textarea, Select,
  Checkbox, Radio, Switch, Tabs, plus a token-built `Callout` for notice boxes.
  Faithful ports of the DS components — inline `style` from the CSS vars +
  React hover/press state. `Button` / `Card` take `as` / `href` for link CTAs.
- **Icons** — `lucide-react`, via `Icon` with an explicit ~35-glyph allow-list
  (`components/ui/Icon.tsx`). **Fonts** — `next/font/google` in `app/layout.tsx`.
- **Logo** — `<BrandMark>` needs 8 PNGs in `public/brand/` (see its README);
  they exceed the design-tool read cap, so until they're exported manually the
  `SiteHeader` wordmark is plain text.
- Screens compose the primitives + token utilities. Don't hand-roll
  `bg-slate-*` / `rounded-xl border` cards, buttons, or inputs — use a
  primitive. No feature colors.

## Database (Prisma + Postgres)

The current script, rubric, practice attempts, expert-help requests, and the
demo usage counter all live in Postgres. `prisma/schema.prisma` models:

| Model | Notes |
| --- | --- |
| `Session` | one row per browser (`vg_sid` cookie). `currentScript` + `rubric` are `Json?` blobs. `currentScript` carries an `id` + a 2–4 word `label` (see below). |
| `Attempt` | FK → `Session` (cascade delete). Newest 50 per session are kept. `scriptId` / `scriptLabel` are denormalized from the current script so the history sidebar can group by script. |
| `ExpertRequest` | `/experts` form submissions. |
| `UsageCounter` | single row (`id = 1`) for the demo cap. |

There is no `Script` table — the "current script" is the `Session.currentScript`
JSON blob. Its `id` is assigned on first save and stays stable while the text is
unchanged (a fresh one is minted when the text changes). Its `label` is a short
Claude-generated title: the **generate** path returns it in the same response
(Claude prefixes a `Title:` line, split off in `lib/anthropic.ts`); the
**bring-your-own** path fetches it from `POST /api/script-label` (a cheap Haiku
call, best-effort) when you continue to practice.

Two connection strings, both secret:

| Env var | schema field | Used for |
| --- | --- | --- |
| `DATABASE_URL_POOLED` | `url` | `@prisma/client` at runtime (pooled — Neon `-pooler` / PgBouncer; carries `?pgbouncer=true`) |
| `DATABASE_URL` | `directUrl` | `prisma migrate` and introspection (direct connection) |

They live in **`.env`** (so the Prisma CLI, which only reads `.env`, picks them
up) and are mirrored in `.env.local` for the Next runtime. If your provider has
no separate pooled endpoint, set both to the same string.

```bash
npm run db:migrate -- --name <change>   # create + apply a migration (dev)
npm run db:deploy                        # apply pending migrations (prod/CI)
npm run db:studio                        # browse the data
```

`npm run build` runs `prisma generate` first; `postinstall` runs it too.

**Identity:** `middleware.ts` sets an httpOnly `vg_sid` cookie (random UUID) on
every request and forwards it via an `x-vg-sid` header. `lib/session.ts`
`getSessionId()` reads it. There are no accounts yet — clearing cookies or
switching browsers starts a fresh session.

**Data access:** server code goes through `lib/sessionState.server.ts` (which
uses the `import { prisma } from "@/lib/prisma"` singleton — never
`new PrismaClient()`). The client goes through `lib/practiceStore.ts`, an async
wrapper over `GET/PATCH /api/state` and `POST/DELETE /api/attempts`.

## Observability

- **Error tracking (Sentry)** — set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local`
  (create a project at sentry.io). Blank = Sentry stays fully disabled and adds
  **zero** client-bundle weight (`next.config.mjs` only wires in the build
  plugin when the DSN is present). With it set: `instrumentation.ts` +
  `sentry.{server,edge}.config.ts` + `instrumentation-client.ts` init the SDK,
  `app/global-error.tsx` catches React render crashes, the API routes call
  `Sentry.captureException` / `captureMessage` in their catch and verification
  paths, and the frontend reports unexpected fetch errors via
  `lib/clientErrors.ts` (lazy-loads the SDK only when a DSN is configured). No
  source-map upload is configured — add `SENTRY_ORG` / `SENTRY_PROJECT` /
  `SENTRY_AUTH_TOKEN` and drop `sourcemaps.disable` for readable stack traces.
- **Structured logs** — all five Claude routes (`generate-script`,
  `practice-feedback`, and the three `/grill` routes — `generate-questions`,
  `followup-question`, `qa-feedback`) log `request received` → `anthropic call
  started` → `succeeded` / `failed` → `response sent`; `expert-request` and
  `script-label` log their own lifecycle; `state` / `attempts` log failures
  only. Every line is prefixed `[<route> <request-id>]` (see `lib/logger.ts`),
  plain `console` — visible in `npm run dev` output or your host's function
  logs.
- **Output verification** — before returning, `lib/verifyOutput.ts` checks the
  practice-feedback response contains all 5 sections (Overall / What landed /
  Gaps vs. the script / Delivery / For your next take) and that a generated
  script is non-empty and structured, plus the `/grill` equivalents (4
  sections for `qa-feedback`; non-empty/well-formed for `generate-questions`
  and `followup-question`). A failure is logged + sent to Sentry and the route
  returns a graceful `502` (`code: feedback_incomplete` / `script_malformed` /
  `questions_malformed` / `followup_malformed`) instead of rendering partial
  content.

## Product analytics & feedback (PostHog)

- **Enable it** — set `NEXT_PUBLIC_POSTHOG_KEY` in `.env.local` (project API key
  from posthog.com); optionally `NEXT_PUBLIC_POSTHOG_HOST` (defaults to
  `https://us.i.posthog.com`, use `https://eu.i.posthog.com` for EU cloud).
  Blank = fully disabled: `posthog-js` is never imported and adds **zero**
  client-bundle weight (it's a lazy `import()` in `lib/analytics.ts`).
- **What's tracked** — navigation and engagement only:
  - `$pageview` on every route (manual, fired from `app/providers.tsx` on App
    Router navigation) + automatic `$pageleave` for time-on-page. This is what
    surfaces funnel drop-off between `/generate`, `/script` and `/experts`.
  - Named events: `script_generated` (`{tone}`), `script_provided`
    (`{tone, method}`), `practice_session_started` (`{tone, source}`),
    `practice_session_completed` (`{used_video, duration_sec}`),
    `feedback_received` (`{used_video, effective_score, effective_band}`),
    `expert_request_submitted` (no properties).
- **What is never sent** — script text, transcript content, feedback text, and
  the expert-form name/email/situation. `track()`'s props are typed to
  primitives so content can't be passed by accident; autocapture, session
  recording and anonymous person profiles are all turned off.
- **In-app feedback** — `components/FeedbackWidget.tsx`: a smiley-rating card
  (5 faces, frustrated→great, reported 1–5) shown at each completion point —
  after a script is generated, after practice coaching is shown, and as a
  floating "Feedback" pill on the landing page. Picking a face reveals an
  optional note; both are reported via PostHog's `survey sent` /
  `survey dismissed` events (`rating`, `rating_label`, `has_comment`,
  `comment`). Gated on `ANALYTICS_ENABLED`; done/dismissed is remembered per
  browser (`vocalgym:survey:<key>` in localStorage). Surveys created in the
  PostHog dashboard also render (SDK default).

## Demo usage cap

A lightweight guard against a shared demo link running up an Anthropic bill. It's
a single combined counter across `/api/generate-script`,
`/api/practice-feedback`, and the three `/grill` routes
(`/api/generate-questions`, `/api/followup-question`, `/api/qa-feedback`) —
**not** per-user rate limiting, and under concurrency it can overshoot by a few.

- **Set the limit** — `DEMO_REQUEST_LIMIT` in `.env.local` (e.g. `100`). Blank or
  `0` disables the cap entirely. Once the count reaches the limit, every route
  above returns `429 { error: "Demo limit reached — please check back later.", code:
  "demo_limit_reached" }` without calling Anthropic, and the UI shows a friendly
  "check back later" notice instead of a red error.
- **Check the count** — `GET /api/usage-count` →
  `{ count, limit, remaining, limited }`. Every counted request also logs
  `[vocalgym] demo usage N/LIMIT` to the server console (visible in `npm run dev`
  output or your host's function logs). To lock the endpoint down, set
  `USAGE_ADMIN_TOKEN` and call it as `/api/usage-count?token=YOUR_TOKEN` (or send
  an `x-admin-token` header).
- **Reset the count** — set the `UsageCounter` row back to zero, e.g. in
  `npm run db:studio`, or:
  `UPDATE "UsageCounter" SET count = 0 WHERE id = 1;`
- **Where it's stored** — the single-row `UsageCounter` table (`id = 1`).
  `recordRequest()` does an atomic `upsert … { increment: 1 }`, so it's durable
  across restarts / serverless cold starts and roughly concurrency-safe.

## Site-wide password gate

Optional, off by default — gates the **entire app** behind a single shared
password. Useful for a staging/preview deploy you don't want publicly
crawlable yet; unrelated to `USAGE_ADMIN_TOKEN` above, which only gates a
couple of admin endpoints.

- **Enable it** — set `SITE_PASSWORD` in `.env.local` (or your host's env
  vars). **Leave it blank/unset and the gate is fully bypassed** —
  `middleware.ts` skips the check entirely, so local dev works exactly as it
  does today with no extra step.
- **How it works** — `middleware.ts` (which already ensures the anonymous
  `vg_sid` session cookie) also checks for a valid `vg_gate` cookie on every
  request when `SITE_PASSWORD` is set. Missing or invalid → redirect to
  `/gate?next=<original path>`, so you land back where you meant to go after
  entering the password. `/gate` and `POST /api/gate` are exempted from the
  check itself (otherwise the redirect would loop into itself).
- **The `/gate` page** (`components/GateForm.tsx`) is a centered form styled
  with the same design-system primitives as the rest of the app (Card,
  Field, Input, Button, the `lock` icon), with a clear inline error on a
  wrong password.
- **The cookie** — set by `POST /api/gate` on a correct password: httpOnly,
  `SameSite=lax`, 1-year `Max-Age`, same shape as `vg_sid`. Its value is a
  salted SHA-256 digest of `SITE_PASSWORD` (`lib/gate.ts`), never the
  plaintext password — middleware recomputes the expected digest from the
  env var on every request rather than storing anything server-side.
  Web-Crypto-based (`crypto.subtle`), so the same code runs unmodified in
  middleware's Edge runtime and the API route's Node runtime.
- **Rotating the password** — just change `SITE_PASSWORD` and redeploy;
  every existing `vg_gate` cookie stops matching immediately (no cookie
  version/allowlist to manage).

## Expert-help requests

The "Get expert help" landing path (`/experts`) is a **contact form, not an AI
feature**. On submit, `POST /api/expert-request` inserts an `ExpertRequest` row
(`id, createdAt, name, email, situation`) and logs `[expert-request <id>] saved
…`. The user sees a "we'll get back to you" confirmation.

Read submitted requests at **`/admin/requests`** (or `GET /api/expert-request`
for JSON). Both are gated by `USAGE_ADMIN_TOKEN` when it's set — `?token=…` or an
`x-admin-token` header — and open otherwise. There's no staff routing yet; you
fulfil these manually by replying to the email with a script the user can then
paste into `/script`.

## Grill mode — "defend your work" (v0 prototype)

**`/grill`** is a small, deliberately isolated prototype of *live AI
pushback*: upload or paste the material you're presenting, get likely
reviewer questions, answer one out loud, get one Claude-generated follow-up
that's actually responsive to what you said (not a fixed list), answer that
too, then get qualitative feedback across both exchanges. It's not linked from
the landing page or nav yet — reach it at `/grill` directly.

1. `POST /api/generate-questions` — `{ source }` → `{ questions }`, a
   numbered list of 3–6 likely reviewer questions, parsed the same way
   `generateScript` splits its leading `Title:` line.
2. Pick a question, answer it with `PracticeRecorder` (reused as-is, plus one
   new optional `contentLabel` prop so the side panel reads "Question" instead
   of "Script"). Same manual-transcript fallback as `/practice` for browsers
   without the Web Speech API.
3. `POST /api/followup-question` — `{ source, originalQuestion, transcript,
   otherQuestions }` → `{ followUp }`, one question from Claude that presses
   on something concrete and real in the answer (an unsupported claim, a gap
   vs. the source, a vague number) rather than a generic "can you elaborate."
4. Answer the follow-up the same way, then `POST /api/qa-feedback` — `{
   source, exchanges }` → `{ feedback }`, qualitative Markdown across both
   exchanges (**Overall** / **Accuracy vs. source** / **Composure** / **For
   next time**), rendered by `QAFeedbackSections.tsx` — a standalone renderer,
   not a reuse of `FeedbackSections.tsx` (practice-feedback's), because the
   section set is different.

**Deliberately v0-scoped**: no persistence (nothing is saved as an `Attempt`;
"Start over" just resets in-memory state, and a refresh loses progress), no
rubric/Effective-score involvement (the recorder's camera toggle still works
but its signal isn't used here), not wired to PostHog. All three routes share
the demo usage cap and the same verify-before-return / structured-logging
conventions as `generate-script` and `practice-feedback` (see "Demo usage cap"
and "Observability" above). See CLAUDE.md "Open questions" for the
content-scored-quality (accuracy/precision as a rubric quality, not just
prose) work this is meant to lead into.

## Quality evals

Separate from unit tests — this measures **output quality** (does the script/
feedback read well and coach the right thing), not correctness. Lives in
`evals/`, runs manually, and is **not** wired into CI or any schedule; re-run
it by hand whenever a prompt (`lib/prompt.ts`) or `MODEL` (`lib/anthropic.ts`)
changes.

```bash
npm run eval                                  # full dataset (14 cases)
EVAL_CASE_IDS=raise-ask npm run eval          # one case, for a quick/cheap check
EVAL_CONCURRENCY=4 npm run eval               # default is 3 in-flight cases
EVAL_JUDGE_MODEL=claude-sonnet-5 npm run eval # cheaper judge, default claude-opus-5
```

What it does, per `evals/dataset.ts` case (14 realistic situations spanning
all 7 tone presets):

1. Calls the **real** `generateScript()` — the actual production code path,
   not a mock.
2. Generates a synthetic rehearsal transcript at `strong` / `average` / `weak`
   delivery quality (`evals/generateSyntheticAttempt.ts`) — a separate Claude
   call that deliberately varies filler words, on-script vs. rambling, and
   length so the eval set has intentionally good *and* bad takes.
3. Runs that transcript through the same `lib/rubric.ts` signal + Effective-
   score computation the app uses client-side (no camera — this models a
   no-video session).
4. Calls the **real** `generatePracticeFeedback()` on the (script, transcript,
   Effective score) — again the actual production path.
5. Grades the feedback with an LLM judge (`evals/judge.ts`, default
   `claude-opus-5` — deliberately not the model under test) on three rubric
   criteria, each a 1–5 score + one-sentence reasoning:
   - **Specificity** — does it reference specifics from *this* transcript,
     not generic coaching filler?
   - **Weakest-area accuracy** — the judge independently names the delivery's
     weakest aspect, then checks whether the feedback's Gaps/Delivery/Next-take
     sections named the same thing.
   - **Tone appropriateness** — does the coaching register match the
     situation (gentle for supportive/personal, measured for high-stakes, …)?
6. Checks, deterministically (not judged — this one's a fact, not an opinion),
   that the weak attempt's computed Effective score actually came out lower
   than the strong attempt's.

Results are written to `evals/results/<ISO-timestamp>.json`, gitignored
(they're generated, cost real API spend to reproduce, and embed full scripts/
transcripts) but stamped with `model`, `judgeModel`, `syntheticModel`,
`promptVersion` (bump `PROMPT_VERSION` in `lib/prompt.ts` when the prompts
change meaningfully), and the git commit, so runs stay comparable over time.
A console summary prints alongside the file.

## Notes

- No auth yet. The current script, rubric, and past practice attempts
  (transcript + coaching notes + any nonverbal summary) are stored in Postgres,
  scoped to the anonymous `vg_sid` session cookie.
- Speech-to-text uses the browser's Web Speech API (Chrome/Edge/Safari). Where
  it's unavailable, the transcript box still accepts typed input.
- Recorded audio is playable during the session but is not saved.
- **Upload a script** (the "Upload a file" button next to the paste box on
  `/script`): `.txt` / `.md` are read directly; `.pdf` is parsed with
  `pdfjs-dist`, dynamically imported only on first PDF use (its worker loads from
  jsDelivr, pinned to the installed version in `lib/scriptImport.ts`). Everything
  runs client-side — the file itself is never sent anywhere. Scanned/image PDFs
  have no selectable text and are rejected with a "paste it instead" message;
  imports are trimmed to 8,000 characters.

### Nonverbal analysis (optional camera)

- Off by default. Toggling it on asks for camera permission and lazy-loads
  MediaPipe Face + Pose Landmarker (`@mediapipe/tasks-vision`). The WASM runtime
  loads from jsDelivr and the `.task` models from Google's public MediaPipe
  bucket — both pinned in `lib/mediapipe.ts`; swap to self-hosted copies if you
  need offline/air-gapped operation.
- During a recording the video frame is sampled every ~500ms. Each sample derives
  head yaw/pitch/roll and gaze (eye-look blendshapes), smile and brow-tension
  blendshapes, and shoulder angle from the pose model. On stop these reduce to a
  small summary (`NonverbalMetrics`): facing-forward %, upright %, smile count,
  brow-tension %, plus timestamped spans for look-aways / leaning in / tension.
- Only that summary is POSTed to `/api/practice-feedback`. Video frames never
  leave the browser. If no camera data is present the feedback flow and prompt
  are exactly as before, with no **Nonverbal** section.
- The numbers are rough 2D estimates from a single webcam — treated as
  approximate in both the UI copy and the model prompt.

### Effectiveness rubric + "Effective" score

- On the `/generate` and `/script` pages, `RubricPicker` shows what "effective" means for the current
  tone/context (`TONE_RUBRIC_PRESETS` in `lib/rubric.ts`), as up to 4 qualities
  from `RUBRIC_ATTRIBUTES`, stack-ranked with percentage weights summing to 100:

  | tone         | preset (weight%) |
  |--------------|------------------|
  | *no preference* | Connected 30 · Present 25 · Clear 25 · Composed 20 |
  | professional | Clear 30 · Confident 25 · Composed 25 · Smooth 20 |
  | personal     | Connected 35 · Warm 25 · Present 20 · Smooth 20 |
  | high-stakes  | Composed 35 · Clear 25 · Confident 20 · Present 20 |
  | supportive   | Warm 35 · Connected 25 · Present 20 · Smooth 20 |
  | persuasive   | Confident 30 · Clear 30 · Connected 20 · Smooth 20 |
  | celebratory  | Warm 40 · Connected 30 · Present 15 · Smooth 15 |
  | defending    | Composed 35 · Clear 25 · Confident 20 · Steady 20 |

  Changing the tone dropdown retunes the picker live (via a same-tab
  `vocalgym:tone-change` event). Editing any chip or weight flips it to a
  **custom** rubric (`custom: true`, saved via `PATCH /api/state`) that no longer
  follows the tone; a "Use the … preset" link switches back.
  `resolveRubric(state)` in `lib/practiceStore.ts` is the source of truth on
  `/practice`: your custom rubric if you made one, otherwise the preset for the
  script's tone.
- `lib/rubric.ts` also holds the signal rubric: each quality is a weighted blend of
  **observable signals** — eye contact, posture, stillness (sway / fidget),
  expressiveness, composure (brow tension), volume and voice steadiness (Web
  Audio RMS via `lib/audioMeter.ts`), fluency (filler-word density), and pace
  (words-per-minute vs. an ideal band).
- After each take, `computeSignals()` turns the transcript + audio + any webcam
  metrics into 0–100 signal scores, and `computeEffective()` rolls the chosen
  qualities up into one weighted **Effective** score with a band label
  (Rough / Getting there / Solid / Dialed in). Qualities with no measurable
  signal this take (e.g. camera off) are shown as "not scored" and excluded from
  the weighted average.
- The rubric + signals go to `/api/practice-feedback`; the score is recomputed
  server-side for a consistent prompt block that names the tone ("For a
  high-stakes conversation, an effective delivery is scored on …") or, if you
  customised, says the qualities were hand-picked. The coaching names the
  Effective score in **Overall** and points **For your next take** at the
  highest-weighted quality that scored lowest.
- Everything is a rough single-take estimate and is labelled as such.
- `defending` ("Defending your work" — presenting/proposing under expert Q&A or
  cross-examination) reuses existing physical/vocal qualities only, including
  `steady` (posture + stillness — renamed from `grounded`, which is reserved for
  a future content-accuracy quality). Scoring transcript content itself (did
  they invent a number, did they hedge honestly) isn't built — see CLAUDE.md
  "Open questions".
