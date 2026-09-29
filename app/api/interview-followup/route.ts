import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewFollowUp } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { PREP_LIMITS, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyFollowUp } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-followup";
const MAX_UPCOMING = 10;

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
    panelistId?: unknown;
    question?: unknown;
    transcript?: unknown;
    upcomingQuestions?: unknown;
  };
  const prep = normalizePrep(payload);

  const panelistId = typeof body.panelistId === "string" ? body.panelistId : "";
  if (!prep.panel.some((p) => p.id === panelistId)) {
    return NextResponse.json({ error: "Unknown interviewer." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > PREP_LIMITS.question) {
    return NextResponse.json({ error: "Missing or over-long question." }, { status: 400 });
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your answer before continuing." },
      { status: 400 },
    );
  }
  if (transcript.length > PREP_LIMITS.transcript) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }
  const upcomingQuestions = Array.isArray(body.upcomingQuestions)
    ? body.upcomingQuestions
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, MAX_UPCOMING)
        .map((q) => q.trim().slice(0, PREP_LIMITS.question))
    : [];

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { transcriptChars: transcript.length });
    const followUp = await generateInterviewFollowUp(
      prep,
      panelistId,
      question,
      transcript,
      upcomingQuestions,
    );
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      followUp: followUp === null ? "none" : "question",
    });

    if (followUp !== null) {
      const check = verifyFollowUp(followUp);
      if (!check.ok) {
        // Never stall the round on a bad follow-up: log it and move on.
        logError(SCOPE, rid, `verification failed: ${check.reason} — skipping follow-up`);
        Sentry.captureMessage("interview-followup verification failed", {
          level: "warning",
          tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
        });
        return NextResponse.json({ followUp: null });
      }
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ followUp });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
