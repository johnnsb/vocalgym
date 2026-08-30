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
