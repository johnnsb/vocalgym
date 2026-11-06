---
name: run-evals
description: Run or interpret VocalGym's AI output-quality evals (evals/, `npm run eval`). Use after changing lib/prompt.ts or MODEL in lib/anthropic.ts, or when asked about eval results.
---

# VocalGym quality evals (`evals/`)

Separate from unit tests: this measures AI **output quality**, not correctness.
Run manually with `npm run eval` (uses the `tsx` devDependency). It isn't wired
into CI or any schedule. Re-run it by hand when `lib/prompt.ts` or `MODEL`
(`lib/anthropic.ts`) changes. Full docs: docs/DEVELOPMENT.md "Quality evals".

- `evals/dataset.ts`: 14 realistic situations covering all 7 tone presets.
- `evals/generateSyntheticAttempt.ts`: a Claude call that writes a synthetic
  rehearsal transcript in place of a human attempt, at `strong` / `average` /
  `weak` delivery quality (it varies filler words, sticking to the script vs.
  rambling, and length).
- `evals/run.ts`: for each case, calls the **real** `generateScript()` and
  `generatePracticeFeedback()` (production code, not mocks) on each synthetic
  attempt, and runs the transcripts through the real `lib/rubric.ts`
  signal/Effective-score computation (no camera). Whether a weak attempt
  scores below a strong one is checked here in code, not by the judge.
- `evals/judge.ts`: a separate Claude call (default `claude-opus-5`, deliberately
  not `MODEL`) scores each feedback response on specificity, weakest-area
  accuracy, and tone appropriateness.
- Output goes to `evals/results/<ISO-timestamp>.json` (gitignored: generated
  output that costs API spend to reproduce). Each file is stamped with `model` /
  `judgeModel` / `syntheticModel` / `PROMPT_VERSION` (`lib/prompt.ts`; bump it
  when prompts change meaningfully) / git commit, so runs can be compared over
  time.
- Each run costs real Anthropic API spend, so confirm with the user before
  starting one.
