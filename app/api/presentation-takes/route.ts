import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSessionId } from "@/lib/session";
import { addTake, listTakes } from "@/lib/presentationPrep.server";
import { errorSummary, logError, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "presentation-takes";

export async function GET() {
  const rid = newRequestId();
  try {
    return NextResponse.json(await listTakes(getSessionId()));
  } catch (err) {
    logError(SCOPE, rid, `GET failed: ${errorSummary(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't load your past runs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rid = newRequestId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    return NextResponse.json(await addTake(getSessionId(), body));
  } catch (err) {
    if (err instanceof Error && err.message === "invalid take") {
      return NextResponse.json({ error: "A run needs a transcript and feedback." }, { status: 400 });
    }
    logError(SCOPE, rid, `POST failed: ${errorSummary(err)}`);
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ error: "Couldn't save this run." }, { status: 500 });
  }
}
