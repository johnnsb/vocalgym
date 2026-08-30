import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { addAttempt, clearAttempts } from "@/lib/sessionState.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "attempts";

// POST   — save a rehearsal attempt, returns the stored row (with id/createdAt)
// DELETE — clear every attempt for this session

export async function POST(request: Request) {
  const rid = newRequestId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  try {
    const attempt = await addAttempt(getSessionId(), {
      script: b.script,
      situation: b.situation,
      tone: b.tone,
      transcript: b.transcript,
      feedback: b.feedback,
      nonverbal: b.nonverbal,
      effective: b.effective,
    });
    return NextResponse.json({ attempt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("attempt requires")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    logError(SCOPE, rid, `POST failed: ${msg}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't save this attempt." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const rid = newRequestId();
  try {
    await clearAttempts(getSessionId());
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(SCOPE, rid, `DELETE failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't clear your history." },
      { status: 500 },
    );
  }
}
