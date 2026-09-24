import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateQAFeedback } from "@/lib/anthropic";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyQAFeedback } from "@/lib/verifyOutput";
import type { QAExchange } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "qa-feedback";
const MAX_SOURCE_LENGTH = 8000;
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_QUESTION_LENGTH = 500;
const MAX_EXCHANGES = 4;

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as { source?: unknown; exchanges?: unknown };

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

  if (!Array.isArray(body.exchanges) || body.exchanges.length === 0) {
    return NextResponse.json(
      { error: "No question/answer exchanges to give feedback on." },
      { status: 400 },
    );
  }

  const exchanges: QAExchange[] = [];
  for (const raw of body.exchanges.slice(0, MAX_EXCHANGES)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { question?: unknown; transcript?: unknown };
    const question = typeof r.question === "string" ? r.question.trim() : "";
    const transcript =
      typeof r.transcript === "string" ? r.transcript.trim() : "";
    if (!question || !transcript) continue;
    exchanges.push({
      question: question.slice(0, MAX_QUESTION_LENGTH),
      transcript: transcript.slice(0, MAX_TRANSCRIPT_LENGTH),
    });
  }
  if (exchanges.length === 0) {
    return NextResponse.json(
      { error: "No complete question/answer exchanges to give feedback on." },
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
    logInfo(SCOPE, rid, "anthropic call started", {
      sourceChars: source.length,
      exchangeCount: exchanges.length,
    });
    const feedback = await generateQAFeedback(source, exchanges);
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      feedbackChars: feedback?.length ?? 0,
    });

    if (!feedback) {
      logError(SCOPE, rid, "verification failed: empty response");
      Sentry.captureMessage("qa-feedback empty response", {
        level: "error",
        tags: { route: SCOPE, rid },
      });
      return NextResponse.json(
        { error: "The model returned an empty response. Try again." },
        { status: 502 },
      );
    }

    const check = verifyQAFeedback(feedback);
    if (!check.ok) {
      logError(
        SCOPE,
        rid,
        `verification failed${check.reason ? ` (${check.reason})` : ""}: missing [${check.missing.join(", ")}]`,
        { preview: (feedback ?? "").slice(0, 400) },
      );
      Sentry.captureMessage("qa-feedback verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "missing-sections" },
        extra: {
          missing: check.missing,
          preview: (feedback ?? "").slice(0, 800),
        },
      });
      return NextResponse.json(
        {
          error:
            "The coaching notes came back incomplete. Please try that take again.",
          code: "feedback_incomplete",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ feedback });
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
