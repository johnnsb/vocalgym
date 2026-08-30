import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateScript } from "@/lib/anthropic";
import { recordRequest } from "@/lib/usageCounter";
import { logError, logInfo, newRequestId } from "@/lib/logger";
import { verifyScript } from "@/lib/verifyOutput";
import { TONES, type Tone } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "generate-script";
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
      situationChars: situation.length,
    });
    const { script, label } = await generateScript(situation, tone);
    logInfo(SCOPE, rid, "anthropic call succeeded", {
      scriptChars: script?.length ?? 0,
      hasLabel: Boolean(label),
    });

    if (!script) {
      logError(SCOPE, rid, "verification failed: empty response");
      Sentry.captureMessage("generate-script empty response", {
        level: "error",
        tags: { route: SCOPE, rid },
      });
      return NextResponse.json(
        { error: "The model returned an empty response. Try again." },
        { status: 502 },
      );
    }

    // Verify: non-empty and reasonably structured before returning.
    const check = verifyScript(script);
    if (!check.ok) {
      logError(SCOPE, rid, `verification failed: ${check.reason}`, {
        preview: (script ?? "").slice(0, 300),
      });
      Sentry.captureMessage("generate-script verification failed", {
        level: "error",
        tags: { route: SCOPE, rid, reason: check.reason ?? "unknown" },
        extra: { preview: (script ?? "").slice(0, 500) },
      });
      return NextResponse.json(
        {
          error: "The generated script looks malformed. Please try again.",
          code: "script_malformed",
        },
        { status: 502 },
      );
    }

    logInfo(SCOPE, rid, "response sent (200)");
    return NextResponse.json({ script, label });
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
