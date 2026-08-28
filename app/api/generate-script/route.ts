import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateScript } from "@/lib/anthropic";
import { TONES, type Tone } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SITUATION_LENGTH = 2000;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as { situation?: unknown; tone?: unknown };

  const situation =
    typeof body.situation === "string" ? body.situation.trim() : "";
  if (!situation) {
    return NextResponse.json(
      { error: "Please describe your situation." },
      { status: 400 },
    );
  }
  if (situation.length > MAX_SITUATION_LENGTH) {
    return NextResponse.json(
      { error: `Situation is too long (${MAX_SITUATION_LENGTH} characters max).` },
      { status: 400 },
    );
  }

  const tone: Tone | undefined =
    typeof body.tone === "string" && (TONES as readonly string[]).includes(body.tone)
      ? (body.tone as Tone)
      : undefined;

  try {
    const script = await generateScript(situation, tone);
    if (!script) {
      return NextResponse.json(
        { error: "The model returned an empty response. Try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ script });
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
