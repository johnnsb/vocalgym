# VocalGym

Practice for the conversations that matter. Describe a situation, pick an
optional tone, and VocalGym generates a short script and talking points you can
rehearse out loud.

Then open **Practice**: record yourself running the script, review the
speech-to-text transcript, and get coaching notes from Claude on what landed and
what to tighten. Past attempts are kept in your browser (localStorage).

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and the Anthropic
SDK.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Anthropic API key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
   ```

   Create a key at <https://console.anthropic.com/settings/keys>.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Project structure

```
app/
  api/generate-script/route.ts     POST endpoint that calls the Claude API
  api/practice-feedback/route.ts   POST endpoint: transcript + script -> coaching
  layout.tsx                       Root layout
  page.tsx                         Home page
  practice/page.tsx                Practice route
  globals.css                      Tailwind entry point
components/
  ScriptGenerator.tsx              Client component: state + data fetching
  ScriptForm.tsx                   Situation textarea + tone dropdown
  ScriptResult.tsx                 Rendered script with copy / regenerate / practice
  PracticeSession.tsx              Practice orchestrator: script, record, feedback, history
  PracticeRecorder.tsx            MediaRecorder + Web Speech API capture
  PracticeFeedback.tsx             Rendered coaching notes
lib/
  anthropic.ts                     Anthropic client + generateScript() / generatePracticeFeedback()
  prompt.ts                        System prompts + prompt builders
  types.ts                         Shared types (tones, request/response shapes)
  practiceStore.ts                 localStorage helpers (current script + attempts)
```

## Configuration

- **Model** — set in `lib/anthropic.ts` (`MODEL`). Defaults to `claude-opus-5`;
  change to `claude-sonnet-5` for lower cost.
- **API key** — read from `ANTHROPIC_API_KEY` at request time. Never hardcoded.

## Notes

- No auth or database. The generated script and past practice attempts
  (transcript + coaching notes) live in the browser's localStorage only.
- Speech-to-text uses the browser's Web Speech API (Chrome/Edge/Safari). Where
  it's unavailable, the transcript box still accepts typed input.
- Recorded audio is playable during the session but is not saved.
