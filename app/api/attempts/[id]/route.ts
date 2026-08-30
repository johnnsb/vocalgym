import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { removeAttempt } from "@/lib/sessionState.server";
import { logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "attempts";

// DELETE one attempt — scoped to the caller's session, so an id from another
// session is a silent no-op.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const rid = newRequestId();
  try {
    await removeAttempt(getSessionId(), params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(
      SCOPE,
      rid,
      `DELETE ${params.id} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't delete that attempt." },
      { status: 500 },
    );
  }
}
