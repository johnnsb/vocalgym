# VocalGym

Practice for the conversations that matter: rehearse out loud, get a transcript,
and get coaching from Claude on what landed and what to tighten.

## What it does

- **Rehearse a script.** Paste or upload your own words (`.txt`, `.md`, `.pdf`),
  or describe the situation and have Claude write a script in the tone you pick.
  Record a take, review the speech-to-text transcript, and get coaching notes.
- **An "Effective" score.** Each take gets one 0–100 score rolled up from
  measurable signals, weighted by what "effective" means for that kind of
  conversation (a high-stakes talk is scored mostly on composure and clarity, a
  personal one on warmth and connection). You can adjust the weights, and the
  coaching targets the highest-weighted quality that scored lowest.
- **Optional camera read.** A rough read on eye contact, posture and
  expressiveness, analyzed in the browser with MediaPipe. Video never leaves the
  browser; only summary numbers are sent.
- **Mock interview.** Describe 1–4 interviewers and, if you like, the role. Claude plans
  questions in each panelist's voice, asks pointed follow-ups based on your
  answers, then gives question-by-question feedback.
- **Presentation run-through.** Rehearse from speaker notes or an imported
  `.pptx`, see which points landed, and optionally take two audience questions
  about what you actually said.
- **Defend your work (prototype).** Upload your material, answer likely reviewer
  questions out loud, and get a follow-up that responds to your answer.

## Who it's for

Anyone preparing for a conversation that matters: a hard personal talk, a raise
request, a job interview, or a presentation.

## How it's built

- **App:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **AI:** the Anthropic SDK; Claude writes scripts, generates coaching
  feedback, and runs the interview and Q&A rounds
- **Speech and video:** the browser's Web Speech API for transcription,
  MediaPipe Tasks Vision for the optional camera read
- **Data:** Prisma with Postgres (Neon), scoped to an anonymous session cookie
- **Ops:** Vercel hosting, Sentry error tracking, PostHog product analytics, a
  demo usage cap and a site-wide password gate
- **Quality:** Vitest unit tests for the `lib/` logic, plus an eval harness
  (`npm run eval`) that runs the real prompts on 14 realistic cases and grades
  the coaching with an LLM judge for specificity, weakest-area accuracy and tone

### Built with Claude Code

I built VocalGym with Claude Code as my pair programmer; most commits are
co-authored with Claude. The working setup is part of the repo:

- [`CLAUDE.md`](CLAUDE.md) holds the project's gotchas, decisions and rules, so
  each session starts with the context the code can't show.
- [`docs/superpowers/`](docs/superpowers/) has the design specs and step-by-step
  implementation plans written before the interview and presentation features
  were built.
- [`.claude/skills/run-evals/`](.claude/skills/run-evals/) is a custom skill for
  running and reading the quality evals after a prompt or model change.
- The UI design system (`components/ui/`, `app/styles/tokens.css`) was ported
  from a Claude Design project.

## Run it locally

You need Node 24, an Anthropic API key and a Postgres database.

```bash
git clone https://github.com/johnnsb/vocalgym.git
cd vocalgym
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY and the DATABASE_* values
npm run db:deploy            # apply the database migrations
npm run dev                  # http://localhost:3000
```

`npm test` runs the unit tests. The [developer guide](docs/DEVELOPMENT.md)
covers database setup, environment variables, deployment and every feature in
detail.

## Status

A working prototype, deployed on Vercel behind a password gate. There are no
user accounts yet; practice history is tied to an anonymous browser session,
and recorded audio isn't saved.
