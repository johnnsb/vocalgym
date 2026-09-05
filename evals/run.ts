#!/usr/bin/env node
// Quality eval runner for VocalGym's two AI features (script generation +
// practice feedback). Separate from unit tests — this measures OUTPUT
// QUALITY against an LLM judge + a couple of objective checks, not
// correctness. Run manually with `npm run eval`; not wired into CI.
//
// For each dataset.ts case:
//   1. Calls the REAL generateScript() (lib/anthropic.ts) — production path.
//   2. Generates a synthetic rehearsal transcript at strong/average/weak
//      quality (evals/generateSyntheticAttempt.ts).
//   3. Runs the transcript through the REAL lib/rubric.ts signal + Effective-
//      score computation (same code the app uses client-side).
//   4. Calls the REAL generatePracticeFeedback() on the (script, transcript,
//      effective score) — production path.
//   5. Scores the feedback with an LLM judge (evals/judge.ts) on specificity,
//      weakest-area accuracy, and tone appropriateness.
//   6. Checks, deterministically, that the weak attempt's computed Effective
//      score is actually lower than the strong attempt's.
//
// Results are written to evals/results/<timestamp>.json, stamped with the
// model, judge model, and prompt version so runs are comparable over time.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Loaded before importing lib/anthropic.ts, which reads ANTHROPIC_API_KEY at
// call time (not at import time), so this ordering is enough. Next.js loads
// these automatically at runtime; a standalone script has to do it itself.
// .env.local takes precedence, matching Next's convention.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // missing file is fine — e.g. CI-less local runs with the key exported directly
  }
}

import { DATASET, type EvalCase } from "./dataset";
import {
  ATTEMPT_QUALITIES,
  generateSyntheticAttempt,
  SYNTHETIC_MODEL,
  type AttemptQuality,
  type SyntheticAttempt,
} from "./generateSyntheticAttempt";
import { judgeFeedback, JUDGE_MODEL, type JudgeResult } from "./judge";
import { generatePracticeFeedback, generateScript, MODEL } from "../lib/anthropic";
import { PROMPT_VERSION } from "../lib/prompt";
import { computeEffective, computeSignals, rubricPreset } from "../lib/rubric";
import type { EffectiveResult, ObservableSignals, Tone } from "../lib/types";
import { verifyFeedback, verifyScript, type FeedbackCheck, type ScriptCheck } from "../lib/verifyOutput";

function log(msg: string) {
  console.log(`[eval] ${msg}`);
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

interface AttemptResult {
  quality: AttemptQuality;
  transcript: string;
  wordCount: number;
  durationSec: number;
  signals: ObservableSignals;
  effective: EffectiveResult;
  feedback: string;
  feedbackCheck: FeedbackCheck;
  judge: JudgeResult;
}

interface ScoreOrdering {
  strongScore: number | null;
  averageScore: number | null;
  weakScore: number | null;
  /** The one hard pass/fail: a weak attempt must score lower than a strong one. */
  strongBeatsWeak: boolean | null;
}

interface CaseResult {
  id: string;
  situation: string;
  tone: Tone;
  notes?: string;
  script: string;
  scriptLabel: string;
  scriptCheck: ScriptCheck;
  attempts: AttemptResult[];
  scoreOrdering: ScoreOrdering;
  error?: string;
}

interface EvalSummary {
  casesRun: number;
  casesErrored: number;
  scriptVerifyPassRate: number;
  feedbackVerifyPassRate: number;
  scoreOrderingPassRate: number;
  avgSpecificity: number;
  avgToneAppropriateness: number;
  weakestAreaAccuracy: number;
}

interface EvalRunResult {
  runAt: string;
  model: string;
  judgeModel: string;
  syntheticModel: string;
  promptVersion: string;
  gitCommit: string | null;
  datasetSize: number;
  cases: CaseResult[];
  summary: EvalSummary;
}

// ---------------------------------------------------------------------------
// Per-case work
// ---------------------------------------------------------------------------

async function runAttempt(
  caseDef: EvalCase,
  script: string,
  quality: AttemptQuality,
): Promise<AttemptResult> {
  const synthetic: SyntheticAttempt = await generateSyntheticAttempt(script, quality, {
    situation: caseDef.situation,
    tone: caseDef.tone,
    caseId: caseDef.id,
  });

  // Same signal + Effective-score computation the app runs client-side. No
  // nonverbal/audio metrics — this models a no-camera practice session, same
  // as computeSignals is called in production when the user's camera is off.
  const signals = computeSignals({
    nonverbal: null,
    audio: null,
    transcript: synthetic.transcript,
    durationSec: synthetic.durationSec,
  });
  const rubric = rubricPreset(caseDef.tone);
  const effective = computeEffective(rubric, signals);

  const feedback = await generatePracticeFeedback(
    script,
    synthetic.transcript,
    caseDef.situation,
    caseDef.tone,
    { effective, signals, rubricCustom: false },
  );
  const feedbackCheck = verifyFeedback(feedback);

  const judge = await judgeFeedback({
    situation: caseDef.situation,
    tone: caseDef.tone,
    script,
    transcript: synthetic.transcript,
    feedback,
  });

  return {
    quality,
    transcript: synthetic.transcript,
    wordCount: synthetic.wordCount,
    durationSec: synthetic.durationSec,
    signals,
    effective,
    feedback,
    feedbackCheck,
    judge,
  };
}

function scoreOrderingFor(attempts: AttemptResult[]): ScoreOrdering {
  const scoreOf = (q: AttemptQuality) =>
    attempts.find((a) => a.quality === q)?.effective.score ?? null;
  const strongScore = scoreOf("strong");
  const averageScore = scoreOf("average");
  const weakScore = scoreOf("weak");
  const strongBeatsWeak =
    strongScore === null || weakScore === null ? null : strongScore > weakScore;
  return { strongScore, averageScore, weakScore, strongBeatsWeak };
}

async function runCase(caseDef: EvalCase): Promise<CaseResult> {
  log(`${caseDef.id}: generating script…`);
  const { script, label } = await generateScript(caseDef.situation, caseDef.tone);
  const scriptCheck = verifyScript(script);
  if (!scriptCheck.ok) {
    log(`${caseDef.id}: script failed verifyScript (${scriptCheck.reason}) — skipping attempts`);
    return {
      id: caseDef.id,
      situation: caseDef.situation,
      tone: caseDef.tone,
      notes: caseDef.notes,
      script,
      scriptLabel: label,
      scriptCheck,
      attempts: [],
      scoreOrdering: { strongScore: null, averageScore: null, weakScore: null, strongBeatsWeak: null },
      error: `verifyScript failed: ${scriptCheck.reason}`,
    };
  }

  const attempts: AttemptResult[] = [];
  const attemptErrors: string[] = [];
  for (const quality of ATTEMPT_QUALITIES) {
    log(`${caseDef.id}: ${quality} attempt…`);
    try {
      attempts.push(await runAttempt(caseDef, script, quality));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`${caseDef.id}: ${quality} attempt failed — ${msg}`);
      attemptErrors.push(`${quality}: ${msg}`);
    }
  }

  return {
    id: caseDef.id,
    situation: caseDef.situation,
    tone: caseDef.tone,
    notes: caseDef.notes,
    script,
    scriptLabel: label,
    scriptCheck,
    attempts,
    scoreOrdering: scoreOrderingFor(attempts),
    ...(attemptErrors.length ? { error: attemptErrors.join("; ") } : {}),
  };
}

// ---------------------------------------------------------------------------
// Concurrency (bounded — this hits the real API ~10 times per case)
// ---------------------------------------------------------------------------

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY) || 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Summary + output
// ---------------------------------------------------------------------------

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function summarize(cases: CaseResult[]): EvalSummary {
  // `attempts` only ever holds attempts that completed successfully, so
  // aggregate across every case — a case can carry a partial `error` (e.g.
  // one of its three quality levels failed) while still contributing its
  // other, successful attempts to these averages.
  const allAttempts = cases.flatMap((c) => c.attempts);
  const orderable = cases.filter((c) => c.scoreOrdering.strongBeatsWeak !== null);

  return {
    casesRun: cases.length,
    casesErrored: cases.filter((c) => c.error).length,
    scriptVerifyPassRate: mean(cases.map((c) => (c.scriptCheck.ok ? 1 : 0))),
    feedbackVerifyPassRate: mean(allAttempts.map((a) => (a.feedbackCheck.ok ? 1 : 0))),
    scoreOrderingPassRate: mean(orderable.map((c) => (c.scoreOrdering.strongBeatsWeak ? 1 : 0))),
    avgSpecificity: mean(allAttempts.map((a) => a.judge.specificity.score)),
    avgToneAppropriateness: mean(allAttempts.map((a) => a.judge.toneAppropriateness.score)),
    weakestAreaAccuracy: mean(allAttempts.map((a) => (a.judge.weakestArea.correct ? 1 : 0))),
  };
}

function gitCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
  } catch {
    return null;
  }
}

function printSummary(result: EvalRunResult) {
  const s = result.summary;
  console.log("\n=== VocalGym quality eval ===");
  console.log(`model=${result.model}  judge=${result.judgeModel}  synthetic=${result.syntheticModel}  prompt=${result.promptVersion}`);
  console.log(`cases: ${s.casesRun} run, ${s.casesErrored} errored`);
  console.log(`script verify pass rate:    ${(s.scriptVerifyPassRate * 100).toFixed(0)}%`);
  console.log(`feedback verify pass rate:  ${(s.feedbackVerifyPassRate * 100).toFixed(0)}%`);
  console.log(`weak < strong score:        ${(s.scoreOrderingPassRate * 100).toFixed(0)}%`);
  console.log(`judge — specificity:        ${s.avgSpecificity.toFixed(2)} / 5`);
  console.log(`judge — tone fit:           ${s.avgToneAppropriateness.toFixed(2)} / 5`);
  console.log(`judge — weakest-area match: ${(s.weakestAreaAccuracy * 100).toFixed(0)}%`);

  for (const c of result.cases) {
    if (c.attempts.length === 0) {
      console.log(`  ✗ ${c.id}: ${c.error ?? "no attempts completed"}`);
      continue;
    }
    const o = c.scoreOrdering;
    const ordering = o.strongBeatsWeak === null ? "n/a" : o.strongBeatsWeak ? "ok" : "FAIL";
    console.log(
      `  ${c.id} [${c.tone}] effective strong/avg/weak = ${o.strongScore}/${o.averageScore}/${o.weakScore} (${ordering})` +
        (c.error ? `  — partial: ${c.error}` : ""),
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Optional subset for a cheap smoke test while iterating, e.g.
 *  `EVAL_CASE_IDS=raise-ask,daughter-curfew npm run eval`. Unset runs the
 *  full dataset. */
function selectCases(): EvalCase[] {
  const ids = process.env.EVAL_CASE_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids?.length) return DATASET;
  const wanted = new Set(ids);
  const selected = DATASET.filter((c) => wanted.has(c.id));
  const missing = Array.from(wanted).filter((id) => !selected.some((c) => c.id === id));
  if (missing.length) log(`EVAL_CASE_IDS: no dataset entry for ${missing.join(", ")} — ignoring`);
  return selected;
}

async function main() {
  const runAt = new Date();
  const cases0 = selectCases();
  log(`starting run — ${cases0.length}/${DATASET.length} cases, concurrency ${CONCURRENCY}`);
  log(`model=${MODEL} judge=${JUDGE_MODEL} synthetic=${SYNTHETIC_MODEL} promptVersion=${PROMPT_VERSION}`);

  const cases = await mapWithConcurrency(cases0, CONCURRENCY, (c) =>
    runCase(c).catch((err) => ({
      id: c.id,
      situation: c.situation,
      tone: c.tone,
      notes: c.notes,
      script: "",
      scriptLabel: "",
      scriptCheck: { ok: false, reason: "threw" as const },
      attempts: [],
      scoreOrdering: { strongScore: null, averageScore: null, weakScore: null, strongBeatsWeak: null },
      error: err instanceof Error ? err.message : String(err),
    })),
  );

  const result: EvalRunResult = {
    runAt: runAt.toISOString(),
    model: MODEL,
    judgeModel: JUDGE_MODEL,
    syntheticModel: SYNTHETIC_MODEL,
    promptVersion: PROMPT_VERSION,
    gitCommit: gitCommit(),
    datasetSize: DATASET.length,
    cases,
    summary: summarize(cases),
  };

  const resultsDir = path.join(process.cwd(), "evals", "results");
  mkdirSync(resultsDir, { recursive: true });
  const filename = `${runAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = path.join(resultsDir, filename);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  printSummary(result);
  log(`wrote ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error("[eval] fatal:", err);
  process.exit(1);
});
