import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { getState, patchState } from "@/lib/sessionState.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "state";

// Per-session store for the "current script", the rubric selection, and the
// rehearsal history — everything that used to live in localStorage.

export async function GET() {
  const rid = newRequestId();
  try {
    const state = await getState(getSessionId());
    return NextResponse.json(state);
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't load your saved data." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const rid = newRequestId();
  let body: { currentScript?: unknown; rubric?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await patchState(getSessionId(), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(SCOPE, rid, `PATCH failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't save your change." },
      { status: 500 },
    );
  }
}
