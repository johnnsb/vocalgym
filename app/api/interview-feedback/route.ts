import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewFeedback } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { normalizeExchanges, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyInterviewFeedback } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-feedback";

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prep = normalizePrep(payload);
  const exchanges = normalizeExchanges((payload as { exchanges?: unknown })?.exchanges);
  if (exchanges.length === 0) {
    return NextResponse.json(
      { error: "Answer at least one question before asking for feedback." },
      { status: 400 },
    );
  }
  const hasKeyPoints = prep.candidate.keyPoints.length > 0;

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", {
      exchanges: exchanges.length,
      hasKeyPoints,
    });
    const feedback = await generateInterviewFeedback(prep, exchanges);
    logInfo(SCOPE, rid, "anthropic call succeeded", { chars: feedback.length });

    const check = verifyInterviewFeedback(feedback, hasKeyPoints);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: missing ${check.missing.join(", ")}`);
      Sentry.captureMessage("interview-feedback verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "missing-sections" },
        extra: { missing: check.missing },
      });
      return NextResponse.json(
        {
          error: "The feedback came back incomplete. Please try again.",
          code: "feedback_incomplete",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ feedback });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
