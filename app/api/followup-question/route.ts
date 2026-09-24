import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateFollowUpQuestion } from "@/lib/anthropic";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyFollowUp } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "followup-question";
const MAX_SOURCE_LENGTH = 8000;
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_QUESTION_LENGTH = 500;
const MAX_OTHER_QUESTIONS = 10;

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as {
    source?: unknown;
    originalQuestion?: unknown;
    transcript?: unknown;
    otherQuestions?: unknown;
  };

  const source = typeof body.source === "string" ? body.source.trim() : "";
  if (!source) {
    return NextResponse.json({ error: "Missing source material." }, { status: 400 });
  }
  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json(
      { error: "Source material is too long." },
      { status: 400 },
    );
  }

  const originalQuestion =
    typeof body.originalQuestion === "string"
      ? body.originalQuestion.trim()
      : "";
  if (!originalQuestion) {
    return NextResponse.json(
      { error: "Missing the original question." },
      { status: 400 },
    );
  }
  if (originalQuestion.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your answer before asking for a follow-up." },
      { status: 400 },
    );
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }

  const otherQuestions = Array.isArray(body.otherQuestions)
    ? body.otherQuestions
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, MAX_OTHER_QUESTIONS)
        .map((q) => q.trim().slice(0, MAX_QUESTION_LENGTH))
    : undefined;

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
    logInfo(SCOPE, rid, "anthropic call started", {
      sourceChars: source.length,
      transcriptChars: transcript.length,
    });
    const followUp = await generateFollowUpQuestion(
      source,
      originalQuestion,
      transcript,
      otherQuestions,
    );
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      followUpChars: followUp?.length ?? 0,
    });

    const check = verifyFollowUp(followUp);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, {
        preview: (followUp ?? "").slice(0, 200),
      });
      Sentry.captureMessage("followup-question verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
      });
      return NextResponse.json(
        {
          error: "The follow-up question came back malformed. Please try again.",
          code: "followup_malformed",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ followUp });
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
