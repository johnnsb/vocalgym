// Lightweight shape checks on model output before it reaches the frontend, so a
// malformed / truncated response becomes a clean error instead of broken UI.

import type { InterviewPanelist } from "./types";

// Matches a Markdown heading line (##, **bold**, or a "- **bold**" bullet) that
// starts with the given section name.
const HEAD = String.raw`(?:^|\n)[ \t]*(?:[-*][ \t]+)?(?:#{1,6}[ \t]+)?\*{0,2}[ \t]*`;

const REQUIRED_FEEDBACK_SECTIONS: { label: string; re: RegExp }[] = [
  ["Overall", String.raw`overall\b`],
  ["What landed", String.raw`what\s+landed\b`],
  ["Gaps vs. the script", String.raw`gaps?\b`],
  ["Delivery", String.raw`delivery\b`],
  ["For your next take", String.raw`(?:for your next take|next take)\b`],
].map(([label, body]) => ({ label, re: new RegExp(HEAD + body, "i") }));

export interface FeedbackCheck {
  ok: boolean;
  missing: string[];
  reason?: string;
}

/** The 5 required sections must all be present. Nonverbal is optional, so it's
 *  not checked here. */
export function verifyFeedback(text: unknown): FeedbackCheck {
  if (typeof text !== "string" || text.trim().length < 60) {
    return {
      ok: false,
      missing: REQUIRED_FEEDBACK_SECTIONS.map((s) => s.label),
      reason: "empty-or-too-short",
    };
  }
  const missing = REQUIRED_FEEDBACK_SECTIONS.filter(
    (s) => !s.re.test(text),
  ).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}

export interface ScriptCheck {
  ok: boolean;
  reason?: string;
}

/** A generated script should be non-empty and look like structured prose
 *  (multiple lines with headings / bullets), not a one-line refusal or blob. */
export function verifyScript(text: unknown): ScriptCheck {
  if (typeof text !== "string") return { ok: false, reason: "not-a-string" };
  const t = text.trim();
  if (t.length < 80) return { ok: false, reason: "too-short" };
  const looksStructured =
    /\n/.test(t) &&
    /(\*\*|(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|goal|opening line|close)/i.test(t);
  if (!looksStructured) return { ok: false, reason: "unstructured" };
  return { ok: true };
}

// --- "Grill" mode (app/grill) ----------------------------------------------

export interface QuestionsCheck {
  ok: boolean;
  reason?: string;
}

/** Upper bound on a single spoken question. The prompts target ~25-30 words
 *  (~150-200 chars); this is a backstop against a runaway reply, not the target.
 *  Nothing upstream truncates, so exceeding it fails instead of clipping. */
const MAX_QUESTION_CHARS = 400;

/** A complete question ends in "?" (allowing a trailing quote/bracket). A
 *  reply cut off by max_tokens, or one that's a statement, fails this. */
function isCompleteQuestion(q: string): boolean {
  return /\?["'”’)\]]*$/.test(q.trim());
}

/** Generated questions should be a handful of non-trivial, complete questions. */
export function verifyQuestions(questions: unknown): QuestionsCheck {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (questions.length > 10) return { ok: false, reason: "too-many" };
  const bad = questions.some(
    (q) => typeof q !== "string" || q.trim().length < 8,
  );
  if (bad) return { ok: false, reason: "malformed-item" };
  if (questions.some((q) => q.trim().length > MAX_QUESTION_CHARS)) {
    return { ok: false, reason: "item-too-long" };
  }
  if (!questions.every((q) => isCompleteQuestion(q))) {
    return { ok: false, reason: "item-not-a-question" };
  }
  return { ok: true };
}

export interface FollowUpCheck {
  ok: boolean;
  reason?: string;
}

/** A follow-up should be a single, complete, non-trivial question — not empty,
 *  not a wall of text (the model ignored the "ONLY the question" instruction),
 *  and not cut off mid-sentence (no trailing "?"). */
export function verifyFollowUp(text: unknown): FollowUpCheck {
  if (typeof text !== "string" || text.trim().length < 8) {
    return { ok: false, reason: "empty-or-too-short" };
  }
  if (text.trim().length > MAX_QUESTION_CHARS) {
    return { ok: false, reason: "too-long" };
  }
  if (!isCompleteQuestion(text)) return { ok: false, reason: "not-a-question" };
  return { ok: true };
}

const REQUIRED_QA_FEEDBACK_SECTIONS: { label: string; re: RegExp }[] = [
  ["Overall", String.raw`overall\b`],
  ["Accuracy vs. source", String.raw`accuracy\b`],
  ["Composure", String.raw`composure\b`],
  ["For next time", String.raw`for next time\b`],
].map(([label, body]) => ({ label, re: new RegExp(HEAD + body, "i") }));

export interface QAFeedbackCheck {
  ok: boolean;
  missing: string[];
  reason?: string;
}

/** The 4 required "grill" feedback sections must all be present. */
export function verifyQAFeedback(text: unknown): QAFeedbackCheck {
  if (typeof text !== "string" || text.trim().length < 60) {
    return {
      ok: false,
      missing: REQUIRED_QA_FEEDBACK_SECTIONS.map((s) => s.label),
      reason: "empty-or-too-short",
    };
  }
  const missing = REQUIRED_QA_FEEDBACK_SECTIONS.filter(
    (s) => !s.re.test(text),
  ).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}

// --- Interview prep (app/prep/interview) ------------------------------------

/** 3-6 complete questions, each attributed to a panelist that exists. The
 *  prompt asks for 4-5; the range is slack, not the target. */
export function verifyInterviewPlan(
  questions: unknown,
  panel: InterviewPanelist[],
): QuestionsCheck {
  if (!Array.isArray(questions) || questions.length < 3) {
    return { ok: false, reason: "too-few" };
  }
  if (questions.length > 6) return { ok: false, reason: "too-many" };
  const ids = new Set(panel.map((p) => p.id));
  for (const q of questions) {
    if (!q || typeof q !== "object" || typeof q.question !== "string") {
      return { ok: false, reason: "malformed-item" };
    }
    if (!ids.has(q.panelistId)) return { ok: false, reason: "unknown-panelist" };
  }
  return verifyQuestions(questions.map((q) => q.question));
}

// Like HEAD, but only bold or level-1/2 headings count as sections: interview
// feedback uses "### <question>" subheadings, and one that happens to start
// with a section name ("### Next round of funding…?") mustn't satisfy it.
const SECTION_HEAD = String.raw`(?:^|\n)[ \t]*(?:[-*][ \t]+)?(?:#{1,2}[ \t]+)?\*{0,2}[ \t]*`;

const INTERVIEW_FEEDBACK_SECTIONS: { label: string; re: RegExp; keyPointsOnly?: boolean }[] = [
  { label: "Overall", body: String.raw`overall\b` },
  { label: "Question by question", body: String.raw`question[\s-]+by[\s-]+question\b` },
  { label: "Key points", body: String.raw`key\s+points\b`, keyPointsOnly: true },
  { label: "Reading the panel", body: String.raw`reading\s+the\s+panel\b` },
  { label: "For your next round", body: String.raw`(?:for\s+your\s+)?next\s+round\b` },
].map(({ label, body, keyPointsOnly }) => ({
  label,
  re: new RegExp(SECTION_HEAD + body, "i"),
  keyPointsOnly,
}));

/** Required interview-feedback sections; "Key points" only when the candidate
 *  gave key points (the prompt tells Claude to omit it otherwise). */
export function verifyInterviewFeedback(
  text: unknown,
  hasKeyPoints: boolean,
): FeedbackCheck {
  const required = INTERVIEW_FEEDBACK_SECTIONS.filter(
    (s) => hasKeyPoints || !s.keyPointsOnly,
  );
  if (typeof text !== "string" || text.trim().length < 60) {
    return {
      ok: false,
      missing: required.map((s) => s.label),
      reason: "empty-or-too-short",
    };
  }
  const missing = required.filter((s) => !s.re.test(text)).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}

const PRESENTATION_FEEDBACK_SECTIONS: { label: string; re: RegExp }[] = [
  ["Overall", String.raw`overall\b`],
  ["Coverage", String.raw`coverage\b`],
  ["Flow & timing", String.raw`flow\s*(?:&|and)\s*timing\b`],
  ["Delivery", String.raw`delivery\b`],
  ["For your next run", String.raw`(?:for\s+your\s+)?next\s+run\b`],
].map(([label, body]) => ({ label, re: new RegExp(SECTION_HEAD + body, "i") }));

const PRESENTATION_QA_SECTION = {
  label: "Q&A",
  re: new RegExp(SECTION_HEAD + String.raw`q\s*(?:&|and)\s*a\b`, "i"),
};

/** Required presentation-feedback sections (Nonverbal is optional — camera
 *  only; Q&A is required only when the run ended with audience Q&A).
 *  Section headings only: bold or #/## (see SECTION_HEAD). */
export function verifyPresentationFeedback(
  text: unknown,
  opts: { hasQa?: boolean } = {},
): FeedbackCheck {
  const required = opts.hasQa
    ? [...PRESENTATION_FEEDBACK_SECTIONS, PRESENTATION_QA_SECTION]
    : PRESENTATION_FEEDBACK_SECTIONS;
  if (typeof text !== "string" || text.trim().length < 60) {
    return { ok: false, missing: required.map((s) => s.label), reason: "empty-or-too-short" };
  }
  const missing = required.filter((s) => !s.re.test(text)).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}
