import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { removeTake } from "@/lib/presentationPrep.server";
import { errorSummary, logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-takes";

// DELETE one take — session-scoped, so a foreign id is a silent no-op.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const rid = newRequestId();
  try {
    await removeTake(getSessionId(), params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(SCOPE, rid, `DELETE failed: ${errorSummary(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't delete that run." }, { status: 500 });
  }
}
