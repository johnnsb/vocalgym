// Lightweight shape checks on model output before it reaches the frontend, so a
// malformed / truncated response becomes a clean error instead of broken UI.

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

/** Generated questions should be a handful of non-trivial, actual questions. */
export function verifyQuestions(questions: unknown): QuestionsCheck {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (questions.length > 10) return { ok: false, reason: "too-many" };
  const bad = questions.some(
    (q) => typeof q !== "string" || q.trim().length < 8,
  );
  if (bad) return { ok: false, reason: "malformed-item" };
  return { ok: true };
}

export interface FollowUpCheck {
  ok: boolean;
  reason?: string;
}

/** A follow-up should be a single non-trivial question, not empty or a wall
 *  of text (which would suggest the model ignored the "ONLY the question"
 *  instruction). */
export function verifyFollowUp(text: unknown): FollowUpCheck {
  if (typeof text !== "string" || text.trim().length < 8) {
    return { ok: false, reason: "empty-or-too-short" };
  }
  if (text.trim().length > 400) return { ok: false, reason: "too-long" };
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
