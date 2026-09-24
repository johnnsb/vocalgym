import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateQuestions } from "@/lib/anthropic";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyQuestions } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "generate-questions";
const MAX_SOURCE_LENGTH = 8000;

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as { source?: unknown };

  const source = typeof body.source === "string" ? body.source.trim() : "";
  if (!source) {
    return NextResponse.json(
      { error: "Upload or paste the material to generate questions from." },
      { status: 400 },
    );
  }
  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json(
      { error: `Source material is too long (${MAX_SOURCE_LENGTH} characters max).` },
      { status: 400 },
    );
  }

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return NextResponse.json(
      {
        error: "Demo limit reached — please check back later.",
        code: "demo_limit_reached",
      },
      { status: 429 },
    );
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { sourceChars: source.length });
    const questions = await generateQuestions(source);
    logInfo(SCOPE, rid, "anthropic call succeeded", { count: questions.length });

    const check = verifyQuestions(questions);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, {
        preview: questions.slice(0, 3).join(" | "),
      });
      Sentry.captureMessage("generate-questions verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
        extra: { count: questions.length },
      });
      return NextResponse.json(
        {
          error: "The generated questions looked malformed. Please try again.",
          code: "questions_malformed",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      logError(SCOPE, rid, "anthropic call failed: authentication");
      Sentry.captureException(err, { tags: { route: SCOPE, rid } });
      return NextResponse.json(
        { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      logError(SCOPE, rid, "anthropic call failed: rate limited");
      return NextResponse.json(
        { error: "Rate limited by the Claude API. Wait a moment and try again." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      logError(SCOPE, rid, `anthropic call failed: API error ${err.status ?? "?"}`);
      Sentry.captureException(err, {
        tags: { route: SCOPE, rid, anthropicStatus: String(err.status ?? "") },
      });
      return NextResponse.json(
        { error: `Claude API error (${err.status ?? "unknown"}).` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    logError(SCOPE, rid, `unhandled error: ${message}`, err);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
