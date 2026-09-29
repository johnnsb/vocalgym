import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { getPrep, savePrep } from "@/lib/interviewPrep.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "interview-prep";

// Per-session interview-prep setup (panel + candidate context). Contains
// third-party personal data (interviewer profiles) — never logged, never sent
// to analytics.

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await getPrep(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't load your saved panel." },
      { status: 500 },
    );
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
    return NextResponse.json(await savePrep(getSessionId(), body));
  } catch (err) {
    logError(SCOPE, rid, `PUT failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't save your panel." },
      { status: 500 },
    );
  }
}
