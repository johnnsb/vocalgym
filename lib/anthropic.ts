import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  FEEDBACK_SYSTEM_PROMPT,
  buildFeedbackPrompt,
  LABEL_SYSTEM_PROMPT,
  buildLabelPrompt,
  QUESTION_SYSTEM_PROMPT,
  buildQuestionsPrompt,
  FOLLOWUP_SYSTEM_PROMPT,
  buildFollowUpPrompt,
  QA_FEEDBACK_SYSTEM_PROMPT,
  buildQAFeedbackPrompt,
  INTERVIEW_PLAN_SYSTEM_PROMPT,
  buildInterviewPlanPrompt,
  INTERVIEW_FOLLOWUP_SYSTEM_PROMPT,
  buildInterviewFollowUpPrompt,
  type FeedbackPromptExtras,
} from "./prompt";
import type {
  InterviewPanelist,
  InterviewPrepState,
  PlannedQuestion,
  QAExchange,
  Tone,
} from "./types";

/**
 * Model used for script generation. Swap this one line to change models
 * (e.g. "claude-opus-5" for higher quality).
 */
export const MODEL = "claude-sonnet-5";

/** Cheap model for the tiny "title this script" task. */
export const LABEL_MODEL = "claude-haiku-4-5-20251001";

const MAX_LABEL_CHARS = 60;

/** Trim a model-produced label to something short and header-safe. */
function cleanLabel(raw: string): string {
  return raw
    .split("\n")[0]
    .replace(/^["'\s]+|["'.\s]+$/g, "")
    .slice(0, MAX_LABEL_CHARS)
    .trim();
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }

  // Identity-linked API keys must name the workspace the request acts in.
  // Optional for classic workspace-scoped keys.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;

  return (client ??= new Anthropic({
    apiKey,
    ...(workspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
      : {}),
  }));
}

export interface GeneratedScript {
  script: string;
  /** 2–4 word label parsed from the leading `Title:` line; "" if absent. */
  label: string;
}

/** Split a leading `Title: ...` line (see SYSTEM_PROMPT) off the script body. */
function splitTitle(text: string): GeneratedScript {
  const m = text.match(/^[ \t]*title:[ \t]*(.+?)[ \t]*\r?\n+/i);
  if (!m) return { script: text, label: "" };
  return { script: text.slice(m[0].length).trimStart(), label: cleanLabel(m[1]) };
}

export async function generateScript(
  situation: string,
  tone?: Tone,
): Promise<GeneratedScript> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(situation, tone) }],
  });

  return splitTitle(textOf(response));
}

/**
 * Tiny/cheap Haiku call to title a script the user brought themselves (the
 * generate path gets its label from `generateScript`). Never throws — returns
 * "" on any failure so the save flow isn't blocked.
 */
export async function generateScriptLabel(
  situation: string,
  script: string,
): Promise<string> {
  try {
    const response = await getClient().messages.create({
      model: LABEL_MODEL,
      max_tokens: 24,
      system: LABEL_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildLabelPrompt(situation, script) },
      ],
    });
    return cleanLabel(textOf(response));
  } catch {
    return "";
  }
}

export async function generatePracticeFeedback(
  script: string,
  transcript: string,
  situation?: string,
  tone?: Tone,
  extras: FeedbackPromptExtras = {},
): Promise<string> {
  const rich = Boolean(extras.nonverbal || extras.effective);
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: rich ? 2600 : 2048,
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildFeedbackPrompt(script, transcript, situation, tone, extras),
      },
    ],
  });

  return textOf(response);
}

/** Trim wrapping quotes/whitespace from a single-line model reply (a question).
 *  Deliberately never truncates: a clipped question reads as a finished one to
 *  the user. Length and the trailing "?" are enforced in lib/verifyOutput.ts
 *  instead, so an over-long or cut-off reply fails loudly (502) rather than
 *  shipping mid-sentence. */
function cleanQuestion(raw: string): string {
  return raw
    .split("\n")[0]
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

const NUMBERED_LINE = /^[ \t]*\d+[.)][ \t]*/;

/** Parse a "1. ...\n2. ..." numbered list (see QUESTION_SYSTEM_PROMPT) into
 *  individual question strings. Only numbered lines count, so a stray preamble
 *  or closing remark can't become a "question". */
function parseQuestions(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => NUMBERED_LINE.test(line))
    .map((line) => cleanQuestion(line.replace(NUMBERED_LINE, "")))
    .filter(Boolean);
}

/** "Grill" mode: generate likely reviewer questions from uploaded material. */
export async function generateQuestions(source: string): Promise<string[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: QUESTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildQuestionsPrompt(source) }],
  });
  return parseQuestions(textOf(response));
}

/** "Grill" mode: one follow-up question grounded in what they actually said. */
export async function generateFollowUpQuestion(
  source: string,
  originalQuestion: string,
  transcript: string,
  otherQuestions?: string[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 200,
    system: FOLLOWUP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildFollowUpPrompt(
          source,
          originalQuestion,
          transcript,
          otherQuestions,
        ),
      },
    ],
  });
  return cleanQuestion(textOf(response));
}

/** "Grill" mode: qualitative feedback across both Q&A exchanges. No numeric
 *  rubric/Effective score involved — see lib/types.ts QAFeedbackResponse. */
export async function generateQAFeedback(
  source: string,
  exchanges: QAExchange[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: QA_FEEDBACK_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildQAFeedbackPrompt(source, exchanges) },
    ],
  });
  return textOf(response);
}

// --- Interview prep (app/prep/interview) ------------------------------------

// "P2: …", tolerating a leading bullet/number and bold markers:
// "- **P1:** …", "2. P2 — …", "3) **P1** - …".
const PLAN_LINE =
  /^[ \t]*(?:[-*•]|\d+[.)])?[ \t]*\**[ \t]*P(\d+)[ \t]*\**[ \t]*[:.)\-–—][ \t]*\**[ \t]*(.+)$/i;

/** Parse the plan (see INTERVIEW_PLAN_SYSTEM_PROMPT) into tagged questions.
 *  Only tagged lines count. An out-of-range tag keeps an empty panelistId so
 *  verifyInterviewPlan rejects the plan instead of rendering "undefined asks". */
export function parseInterviewPlan(
  text: string,
  panel: InterviewPanelist[],
): PlannedQuestion[] {
  const out: PlannedQuestion[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(PLAN_LINE);
    if (!m) continue;
    const question = cleanQuestion(m[2].replace(/\*+/g, ""));
    if (!question) continue;
    out.push({ panelistId: panel[Number(m[1]) - 1]?.id ?? "", question });
  }
  return out;
}

export async function generateInterviewPlan(
  prep: InterviewPrepState,
): Promise<PlannedQuestion[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: INTERVIEW_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildInterviewPlanPrompt(prep) }],
  });
  return parseInterviewPlan(textOf(response), prep.panel);
}

/** `null` = the model said NONE (answer was complete). `""` = empty reply
 *  (caller's verification treats it as malformed). A reply starting "None"
 *  that ends in "?" is a real question, not NONE. */
export function parseFollowUp(text: string): string | null {
  const q = cleanQuestion(text.trim().replace(/^\*+|\*+$/g, ""));
  if (!q) return "";
  if (/^\**none\b/i.test(q) && !q.endsWith("?")) return null;
  return q;
}

export async function generateInterviewFollowUp(
  prep: InterviewPrepState,
  panelistId: string,
  question: string,
  transcript: string,
  upcomingQuestions: string[],
): Promise<string | null> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 200,
    system: INTERVIEW_FOLLOWUP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildInterviewFollowUpPrompt(
          prep,
          panelistId,
          question,
          transcript,
          upcomingQuestions,
        ),
      },
    ],
  });
  return parseFollowUp(textOf(response));
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
