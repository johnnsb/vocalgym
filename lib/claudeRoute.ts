import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logError } from "./logger";

// Shared responses for the interview-prep Claude routes. Same behavior as the
// inline blocks in the older routes (which are deliberately left as-is).

export function demoLimitResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Demo limit reached — please check back later.",
      code: "demo_limit_reached",
    },
    { status: 429 },
  );
}

export function anthropicErrorResponse(
  err: unknown,
  scope: string,
  rid: string,
): NextResponse {
  if (err instanceof Anthropic.AuthenticationError) {
    logError(scope, rid, "anthropic call failed: authentication");
    Sentry.captureException(err, { tags: { route: scope, rid } });
    return NextResponse.json(
      { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    logError(scope, rid, "anthropic call failed: rate limited");
    return NextResponse.json(
      { error: "Rate limited by the Claude API. Wait a moment and try again." },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    logError(scope, rid, `anthropic call failed: API error ${err.status ?? "?"}`);
    Sentry.captureException(err, {
      tags: { route: scope, rid, anthropicStatus: String(err.status ?? "") },
    });
    return NextResponse.json(
      { error: `Claude API error (${err.status ?? "unknown"}).` },
      { status: 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  logError(scope, rid, `unhandled error: ${message}`, err);
  Sentry.captureException(err, { tags: { route: scope, rid } });
  return NextResponse.json({ error: message }, { status: 500 });
}
