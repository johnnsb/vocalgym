import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generatePracticeFeedback } from "@/lib/anthropic";
import { coerceNonverbal } from "@/lib/nonverbal";
import { coerceSignals, computeEffective } from "@/lib/rubric";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyFeedback } from "@/lib/verifyOutput";
import { RUBRIC_ATTRIBUTES, TONES, type RubricSelection, type Tone } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "practice-feedback";
const MAX_SCRIPT_LENGTH = 8000;
const MAX_TRANSCRIPT_LENGTH = 12000;
const MAX_SITUATION_LENGTH = 2000;

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
    script?: unknown;
    transcript?: unknown;
    situation?: unknown;
    tone?: unknown;
    nonverbal?: unknown;
    rubric?: unknown;
    signals?: unknown;
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

  const nonverbal = coerceNonverbal(body.nonverbal);

  // The rubric + signals are client-computed; recompute the score here so the
  // prompt block is consistent, and ignore anything malformed.
  const signals = coerceSignals(body.signals);
  let rubric: RubricSelection | null = null;
  if (body.rubric && typeof body.rubric === "object") {
    const rb = body.rubric as {
      attributes?: unknown;
      weights?: unknown;
      custom?: unknown;
    };
    if (Array.isArray(rb.attributes)) {
      rubric = {
        attributes: rb.attributes.filter(
          (a): a is RubricSelection["attributes"][number] =>
            typeof a === "string" &&
            (RUBRIC_ATTRIBUTES as readonly string[]).includes(a),
        ),
        weights:
          rb.weights && typeof rb.weights === "object"
            ? (rb.weights as Record<string, number>)
            : {},
        custom: rb.custom === true,
      };
    }
  }
  const effective = signals ? computeEffective(rubric, signals) : null;

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
      tone: tone ?? "none",
      scriptChars: script.length,
      transcriptChars: transcript.length,
      hasNonverbal: Boolean(nonverbal),
      hasRubric: Boolean(effective),
    });
    const feedback = await generatePracticeFeedback(
      script,
      transcript,
      situation,
      tone,
      { nonverbal, effective, signals, rubricCustom: rubric?.custom === true },
    );
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      feedbackChars: feedback?.length ?? 0,
    });

    if (!feedback) {
      logError(SCOPE, rid, "verification failed: empty response");
      Sentry.captureMessage("practice-feedback empty response", {
        level: "error",
        tags: { route: SCOPE, rid },
      });
      return NextResponse.json(
        { error: "The model returned an empty response. Try again." },
        { status: 502 },
      );
    }

    // Verify: the response must contain all 5 required feedback sections.
    const check = verifyFeedback(feedback);
    if (!check.ok) {
      logError(
        SCOPE,
        rid,
        `verification failed${check.reason ? ` (${check.reason})` : ""}: missing [${check.missing.join(", ")}]`,
        { preview: (feedback ?? "").slice(0, 400) },
      );
      Sentry.captureMessage("practice-feedback verification failed", {
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
    const message =
      err instanceof Error ? err.message : "Unexpected server error.";
    logError(SCOPE, rid, `unhandled error: ${message}`, err);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
