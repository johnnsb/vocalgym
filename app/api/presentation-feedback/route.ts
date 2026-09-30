import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generatePresentationFeedback } from "@/lib/anthropic";
import { anthropicErrorResponse, demoLimitResponse } from "@/lib/claudeRoute";
import { coerceNonverbal } from "@/lib/nonverbal";
import {
  PRESENTATION_LIMITS,
  normalizePresentationPrep,
  normalizeSlideTimings,
  presentationHasContent,
} from "@/lib/presentationPrep";
import { PRESENTATION_RUBRIC, coerceSignals, computeEffective } from "@/lib/rubric";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyPresentationFeedback } from "@/lib/verifyOutput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-feedback";

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
    prep?: unknown;
    transcript?: unknown;
    durationSec?: unknown;
    slideTimings?: unknown;
    nonverbal?: unknown;
    signals?: unknown;
  };

  const prep = normalizePresentationPrep(body.prep);
  if (!presentationHasContent(prep)) {
    return NextResponse.json(
      { error: "Add your notes or slides before asking for feedback." },
      { status: 400 },
    );
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json(
      { error: "Record or type your run-through before asking for feedback." },
      { status: 400 },
    );
  }
  if (transcript.length > PRESENTATION_LIMITS.transcript) {
    return NextResponse.json({ error: "Transcript is too long." }, { status: 400 });
  }
  const durationSec =
    typeof body.durationSec === "number" && Number.isFinite(body.durationSec)
      ? Math.min(Math.max(Math.round(body.durationSec), 0), PRESENTATION_LIMITS.durationSecMax)
      : 0;
  const slideTimings =
    prep.mode === "slides" ? normalizeSlideTimings(body.slideTimings, prep.slides) : [];
  const nonverbal = coerceNonverbal(body.nonverbal);
  const signals = coerceSignals(body.signals);
  // Recomputed server-side (as practice-feedback does) so the number Claude
  // narrates matches the one the client showed.
  const effective = signals ? computeEffective(PRESENTATION_RUBRIC, signals) : null;

  const usage = await recordRequest();
  if (!usage.allowed) {
    logInfo(SCOPE, rid, "blocked by demo request cap");
    return demoLimitResponse();
  }

  try {
    logInfo(SCOPE, rid, "anthropic call started", {
      mode: prep.mode,
      slides: prep.slides.length,
      transcriptChars: transcript.length,
      hasCamera: nonverbal != null,
    });
    const feedback = await generatePresentationFeedback({
      prep,
      transcript,
      durationSec,
      slideTimings,
      nonverbal,
      effective,
      signals,
    });
    logInfo(SCOPE, rid, "anthropic call succeeded", { chars: feedback.length });

    const check = verifyPresentationFeedback(feedback);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: missing ${check.missing.join(", ")}`);
      Sentry.captureMessage("presentation-feedback verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "missing-sections" },
        extra: { missing: check.missing },
      });
      return NextResponse.json(
        { error: "The feedback came back incomplete. Please try again.", code: "feedback_incomplete" },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ feedback });
  } catch (err) {
    return anthropicErrorResponse(err, SCOPE, rid);
  }
}
