import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { getPresentationPrep, savePresentationPrep } from "@/lib/presentationPrep.server";
import { errorSummary, logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-prep";

// The session's presentation setup. User content — never logged or tracked.

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await getPresentationPrep(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${errorSummary(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't load your saved setup." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const rid = newRequestId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    return NextResponse.json(await savePresentationPrep(getSessionId(), body));
  } catch (err) {
    logError(SCOPE, rid, `PUT failed: ${errorSummary(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't save your setup." }, { status: 500 });
  }
}
