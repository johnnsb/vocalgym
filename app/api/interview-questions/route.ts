import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateInterviewPlan } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { hasPanelContent, normalizePrep } from "@/lib/interviewPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyInterviewPlan } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-questions";

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
  if (!hasPanelContent(prep)) {
    return NextResponse.json(
      { error: "Tell us something about at least one interviewer first." },
      { status: 400 },
    );
  }

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { panelSize: prep.panel.length });
    const questions = await generateInterviewPlan(prep);
    logInfo(SCOPE, rid, "anthropic call succeeded", { questionCount: questions.length });

    // No text preview in the log (unlike /grill) — questions may quote
    // interviewer details, which are third-party personal data.
    const check = verifyInterviewPlan(questions, prep.panel);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, {
        count: questions.length,
      });
      Sentry.captureMessage("interview-questions verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
      });
      return NextResponse.json(
        {
          error: "The interview questions came back malformed. Please try again.",
          code: "interview_plan_malformed",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ questions });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
