import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateScriptLabel } from "@/lib/anthropic";
import { logError, logInfo, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "script-label";
const MAX_SITUATION = 2000;
const MAX_SCRIPT = 8000;

// Tiny Haiku call to title a script the user brought themselves (the generate
// path gets its label in the same response). Best-effort: any failure returns
// { label: "" } with 200 so the save flow is never blocked. Not counted against
// the demo request cap.
export async function POST(request: Request) {
  const rid = newRequestId();

  let body: { situation?: unknown; script?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const situation =
    typeof body.situation === "string" ? body.situation.slice(0, MAX_SITUATION) : "";
  const script =
    typeof body.script === "string" ? body.script.slice(0, MAX_SCRIPT) : "";

  if (!situation.trim() && !script.trim()) {
    return NextResponse.json({ label: "" });
  }

  try {
    const label = await generateScriptLabel(situation, script);
    logInfo(SCOPE, rid, "label generated", { hasLabel: Boolean(label) });
    return NextResponse.json({ label });
  } catch (err) {
    logError(
      SCOPE,
      rid,
      `failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json({ label: "" });
  }
}
