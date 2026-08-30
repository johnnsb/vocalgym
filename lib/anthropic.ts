import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  FEEDBACK_SYSTEM_PROMPT,
  buildFeedbackPrompt,
  type FeedbackPromptExtras,
} from "./prompt";
import type { Tone } from "./types";

/**
 * Model used for script generation. Swap this one line to change models
 * (e.g. "claude-opus-5" for higher quality).
 */
export const MODEL = "claude-sonnet-5";

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

export async function generateScript(
  situation: string,
  tone?: Tone,
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(situation, tone) }],
  });

  return textOf(response);
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

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
