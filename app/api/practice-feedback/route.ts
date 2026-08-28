import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generatePracticeFeedback } from "@/lib/anthropic";
import { TONES, type Tone } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SCRIPT_LENGTH = 8000;
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_SITUATION_LENGTH = 2000;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as {
    script?: unknown;
    transcript?: unknown;
    situation?: unknown;
    tone?: unknown;
  };

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) {
    return NextResponse.json(
      { error: "No script to practice against. Generate one first." },
      { status: 400 },
    );
  }
  if (script.length > MAX_SCRIPT_LENGTH) {
    return NextResponse.json({ error: "Script is too long." }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your attempt before asking for feedback." },
      { status: 400 },
    );
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: "Transcript is too long." },
      { status: 400 },
    );
  }

  const situation =
    typeof body.situation === "string"
      ? body.situation.trim().slice(0, MAX_SITUATION_LENGTH)
      : "";

  const tone: Tone | undefined =
    typeof body.tone === "string" &&
    (TONES as readonly string[]).includes(body.tone)
      ? (body.tone as Tone)
      : undefined;

  try {
    const feedback = await generatePracticeFeedback(
      script,
      transcript,
      situation,
      tone,
    );
    if (!feedback) {
      return NextResponse.json(
        { error: "The model returned an empty response. Try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ feedback });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the Claude API. Wait a moment and try again." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status ?? "unknown"}).` },
        { status: 502 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
