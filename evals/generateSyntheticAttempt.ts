// Synthetic practice-attempt generator. Stands in for a human rehearsing a
// script out loud and being caught by speech-to-text, at one of three
// deliberately different quality levels. This is eval test-data generation —
// it never touches the production code paths under test (lib/anthropic.ts's
// generateScript / generatePracticeFeedback), it only *feeds* them.

import { MODEL } from "../lib/anthropic";
import type { Tone } from "../lib/types";
import { getEvalClient } from "./client";

export type AttemptQuality = "strong" | "average" | "weak";

export const ATTEMPT_QUALITIES: AttemptQuality[] = ["strong", "average", "weak"];

export interface SyntheticAttempt {
  quality: AttemptQuality;
  transcript: string;
  wordCount: number;
  /** Assumed speaking rate used to derive a synthetic duration (no real audio exists). */
  assumedWpm: number;
  durationSec: number;
}

/** Model used to synthesize practice transcripts. Kept separate from the
 *  production MODEL constant even though it currently points at the same
 *  model — swap independently if synthetic-data cost/quality needs differ. */
export const SYNTHETIC_MODEL = MODEL;

// Assumed speaking rate per quality level, used only to turn a synthetic
// transcript's word count into a plausible durationSec for
// lib/rubric.ts's computeSignals (real practice attempts get this from
// actual audio length). 110–155 wpm is the "good" pace band in paceScore().
const WPM_BY_QUALITY: Record<AttemptQuality, number> = {
  strong: 130, // comfortably inside the good-pace band
  average: 165, // a bit rushed — mildly penalized
  weak: 205, // clearly rushed (see weakVariant "rushed") — heavily penalized
};
const WPM_WEAK_RAMBLING = 210; // the "rambling" weak variant is *also* fast/breathless

type WeakVariant = "rambling" | "rushed-short";

/** Deterministic per-case pick so the same case always exercises the same
 *  weak-attempt failure mode across runs, while the dataset as a whole covers
 *  both "pads it out" and "bails early" — the two length failure modes the
 *  eval is meant to catch. */
function weakVariantFor(caseId: string): WeakVariant {
  let hash = 0;
  for (let i = 0; i < caseId.length; i++) {
    hash = (hash * 31 + caseId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "rambling" : "rushed-short";
}

const SYNTHETIC_SYSTEM_PROMPT = `You generate realistic speech-to-text transcripts of someone rehearsing a prepared script out loud, for testing purposes.

Output ONLY the transcript — no title, no markdown, no stage directions, no quotation marks around the whole thing, no commentary before or after. Write it as raw spoken language: run-on sentences are fine, minimal punctuation, first person, as a real speech-to-text engine would render it (include filler words as plain lowercase text like "um", "uh", "like", "you know" when the quality level calls for them — do not censor or bracket them).

The person is speaking from memory/notes, not reading verbatim, so wording will naturally drift from the script even at the highest quality level. Never produce a clean, robotic recitation of the script text.

Always DELIVER the content directly — never narrate your intention to say it. "I want to be specific about the impact" or "here's what I'd say if it gets tense" is meta-commentary describing the plan, not the plan itself; a real rehearsal (even a rough one) says the actual line. This applies at every quality level, including weak ones — a weak take is bad because of hedging, rambling, filler, or skipped content, not because it describes itself in the third person.`;

const QUALITY_GUIDANCE: Record<AttemptQuality, string> = {
  strong: `Quality: STRONG take.
- Hits every key talking point from the script, in roughly the given order, in the speaker's own words.
- Confident, fluent, on-message. At most one mild filler word total — this person is well-rehearsed.
- Delivers the actual ask/close clearly, without hedging it away.
- If the script has an "if it gets tense" contingency, actually SAY that line as if responding in the moment (e.g. "I hear you, but...") — do not preface it with "and if it gets tense, I'd say" or similar narration.
- Natural spoken length for this script — not padded, not rushed.`,
  average: `Quality: AVERAGE take.
- Covers most key talking points but loses some precision: reorders a point or two, softens the ask more than the script does, repeats itself once.
- A moderate number of filler words and hedges scattered throughout (um, uh, like, you know, I guess) — noticeable but not constant.
- Runs a bit long from mild over-explaining and backtracking mid-sentence.`,
  weak: "", // filled in per-variant below
};

const WEAK_VARIANT_GUIDANCE: Record<WeakVariant, string> = {
  rambling: `Quality: WEAK take (rambling variant).
- Starts on-script but drifts into a tangent partway through and struggles to get back on track.
- Heavy filler words and hedging throughout (um, uh, like, you know, I mean, I guess, kind of, sort of) — at least one every sentence or two.
- Repeats itself, restarts sentences, and second-guesses out loud.
- Runs noticeably longer than the script from padding and repetition, but still limps to some kind of ending.
- Softens or garbles the actual ask/close — it's present but weak and hedged.`,
  "rushed-short": `Quality: WEAK take (rushed/short variant).
- Rushes through the opening, visibly avoids the hardest part of the conversation, and cuts out early — skips or badly compresses at least one key talking point, especially the actual ask/close.
- Frequent filler words and false starts (um, uh, like, so, I guess) even though it's short.
- Noticeably shorter than the script — this person bailed before finishing what they meant to say.`,
};

function buildSyntheticPrompt(
  script: string,
  quality: AttemptQuality,
  weakVariant: WeakVariant,
  situation?: string,
  tone?: Tone,
): string {
  const lines = [
    situation ? `Situation: ${situation}` : "",
    tone ? `Tone/context: ${tone}` : "",
    "",
    "--- PREPARED SCRIPT THEY WERE REHEARSING ---",
    script.trim(),
    "",
    quality === "weak" ? WEAK_VARIANT_GUIDANCE[weakVariant] : QUALITY_GUIDANCE[quality],
    "",
    "Write the transcript now.",
  ];
  return lines.filter(Boolean).join("\n");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function generateSyntheticAttempt(
  script: string,
  quality: AttemptQuality,
  opts: { situation?: string; tone?: Tone; caseId?: string } = {},
): Promise<SyntheticAttempt> {
  const weakVariant = weakVariantFor(opts.caseId ?? script.slice(0, 40));
  const response = await getEvalClient().messages.create({
    model: SYNTHETIC_MODEL,
    max_tokens: 1024,
    system: SYNTHETIC_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildSyntheticPrompt(script, quality, weakVariant, opts.situation, opts.tone),
      },
    ],
  });

  const transcript = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const wordCount = countWords(transcript);
  const assumedWpm =
    quality === "weak" && weakVariant === "rambling" ? WPM_WEAK_RAMBLING : WPM_BY_QUALITY[quality];
  const durationSec = wordCount > 0 ? Math.round((wordCount / assumedWpm) * 60) : 0;

  return { quality, transcript, wordCount, assumedWpm, durationSec };
}
