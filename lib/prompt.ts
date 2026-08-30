import type {
  EffectiveResult,
  NonverbalMetrics,
  ObservableSignals,
  Tone,
} from "./types";
import { formatNonverbalForPrompt } from "./nonverbal";
import { formatRubricForPrompt } from "./rubric";

export const SYSTEM_PROMPT = `You are a communication coach. You help people prepare for real, spoken conversations that feel high-stakes to them — difficult family talks, negotiations, pitches, feedback, apologies, and the like.

Given a situation, produce a short, practical script the person can rehearse out loud in two to three minutes.

Begin your response with a single line in exactly this form:
Title: <a 2-4 word label for this conversation, like a chat title — no quotes, no trailing punctuation>
Then a blank line, then the script.

Format the script in Markdown with exactly these sections:
- **Goal** — one sentence naming what a good outcome looks like.
- **Opening line** — a specific sentence they can say to start.
- **Key talking points** — 3 to 5 bullets, each a short thing to say in their own voice (not stage directions).
- **If it gets tense** — 2 bullets: a de-escalating phrase or a way to steer back on track.
- **Close** — one sentence to end on.

Write in plain, natural spoken language. No jargon, no filler, and no preamble before the script.`;

const TONE_GUIDANCE: Record<Tone, string> = {
  professional:
    "Keep it professional and measured — appropriate for colleagues or clients.",
  personal:
    "Keep it warm and personal — this is someone they care about, not a transaction.",
  "high-stakes":
    "Treat this as high-stakes: calm, clear, and deliberate, and acknowledge the weight of the moment.",
  supportive:
    "Lead with support and reassurance — the other person may be anxious or hurting.",
  persuasive:
    "Be persuasive: make a clear ask, lead with the other side's interests, and give concrete reasons.",
  celebratory:
    "Keep it upbeat and celebratory while staying sincere and specific.",
};

export const LABEL_SYSTEM_PROMPT =
  "You write very short titles for saved conversation scripts, like chat titles. " +
  "Given a situation and/or a script, reply with ONLY a 2-4 word label — no quotes, " +
  "no trailing punctuation, no explanation. Examples: \"Boss — raise ask\", " +
  "\"Daughter curfew talk\", \"Investor pitch intro\".";

export function buildLabelPrompt(situation: string, script: string): string {
  const lines: string[] = [];
  if (situation.trim()) lines.push(`Situation: ${situation.trim()}`);
  if (script.trim()) {
    lines.push(`Script excerpt:\n${script.trim().slice(0, 600)}`);
  }
  lines.push("", "Label:");
  return lines.join("\n");
}

export function buildUserPrompt(situation: string, tone?: Tone): string {
  const lines = [`Situation: ${situation}`];
  if (tone) {
    lines.push(`Tone/context: ${tone}. ${TONE_GUIDANCE[tone]}`);
  }
  lines.push("", "Write the script.");
  return lines.join("\n");
}

export const FEEDBACK_SYSTEM_PROMPT = `You are a communication coach reviewing a rehearsal. The user was given a prepared script for a real spoken conversation, practiced it out loud, and their attempt was captured by speech-to-text — so expect some transcription noise and do not comment on it. Sometimes the user also turns on their webcam, in which case rough nonverbal signals (eye contact, posture, expressiveness) are included below.

Compare the attempt to the script and give focused, encouraging feedback the user can act on before their next take.

Format the response in Markdown with these sections, in this order:
- **Overall** — two sentences on how close the attempt is to being ready, in plain terms.
- **What landed** — 2 to 3 bullets naming specific things they did well. Quote short phrases from their attempt where it helps.
- **Gaps vs. the script** — 2 to 3 bullets: talking points they skipped, softened, or rushed past. Name the script section.
- **Delivery** — 2 to 3 bullets on hedging, filler, over-explaining, or wording that undercuts the message.
- **Nonverbal** — include this section ONLY if nonverbal webcam signals are provided below. 2 to 4 bullets on eye contact, posture, and expressiveness, grounded in the numbers given. Treat the numbers as rough estimates, not exact truth, and don't over-interpret small differences. If no nonverbal signals are provided, omit this section entirely.
- **For your next take** — 2 to 3 concrete, prioritized changes.

If an EFFECTIVENESS RUBRIC is provided below, it defines which qualities matter for this conversation and how much (either tuned to the tone/context or hand-picked by the user). Name the "Effective" score once in **Overall**, and let the rubric steer **For your next take** toward the highest-weighted quality that scored lowest. Do not add a separate rubric section and do not print the numbers as a table.

Be direct but supportive. No preamble before the feedback.`;

export interface FeedbackPromptExtras {
  nonverbal?: NonverbalMetrics | null;
  effective?: EffectiveResult | null;
  signals?: ObservableSignals | null;
  /** true when the rubric was hand-edited rather than the tone preset. */
  rubricCustom?: boolean;
}

export function buildFeedbackPrompt(
  script: string,
  transcript: string,
  situation?: string,
  tone?: Tone,
  extras: FeedbackPromptExtras = {},
): string {
  const lines = [
    `Situation: ${situation?.trim() || "(not provided)"}`,
  ];
  if (tone) {
    lines.push(`Tone/context: ${tone}. ${TONE_GUIDANCE[tone]}`);
  }
  lines.push(
    "",
    "--- PREPARED SCRIPT ---",
    script.trim(),
    "",
    "--- REHEARSAL TRANSCRIPT ---",
    transcript.trim(),
  );
  if (extras.nonverbal) {
    lines.push("", `--- ${formatNonverbalForPrompt(extras.nonverbal)}`);
  }
  if (extras.effective && extras.signals) {
    lines.push(
      "",
      `--- ${formatRubricForPrompt(extras.effective, extras.signals, {
        tone,
        custom: extras.rubricCustom,
      })}`,
    );
  }
  lines.push("", "Give the feedback.");
  return lines.join("\n");
}
