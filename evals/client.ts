// Shared Anthropic client for eval-only calls (synthetic transcript
// generation + the LLM judge). Deliberately separate from the singleton in
// lib/anthropic.ts, which is private to that module — production code paths
// under test (generateScript / generatePracticeFeedback) still go through
// lib/anthropic.ts unmodified.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getEvalClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key " +
        "(evals/run.ts loads .env.local / .env automatically).",
    );
  }
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return (client ??= new Anthropic({
    apiKey,
    ...(workspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
      : {}),
  }));
}
