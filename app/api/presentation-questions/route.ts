import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generatePresentationQuestions } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import {
  PRESENTATION_LIMITS,
  normalizePresentationPrep,
  presentationHasContent,
} from "@/lib/presentationPrep";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyQuestions } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-questions";

// Two audience questions after a presentation run-through (opt-in Q&A).
export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = (payload ?? {}) as { prep?: unknown; transcript?: unknown };

  const prep = normalizePresentationPrep(body.prep);
  if (!presentationHasContent(prep)) {
    return NextResponse.json({ error: "Add your notes or slides first." }, { status: 400 });
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your run-through before taking questions." },
      { status: 400 },
    );
  }
  if (transcript.length > PRESENTATION_LIMITS.transcript) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", { mode: prep.mode, transcriptChars: transcript.length });
    const all = await generatePresentationQuestions(prep, transcript);
    logInfo(SCOPE, rid, "anthropic call succeeded", { count: all.length });

    const check = all.length > 3 ? { ok: false, reason: "too-many" } : verifyQuestions(all);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, { count: all.length });
      Sentry.captureMessage("presentation-questions verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
      });
      return NextResponse.json(
        { error: "The audience questions came back malformed. Please try again.", code: "questions_malformed" },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ questions: all.slice(0, 2) });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
