import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  loadExpertRequests,
  saveExpertRequest,
} from "@/lib/expertRequests";
import { logError, logInfo, newRequestId } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "expert-request";
const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_SITUATION = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rid = newRequestId();
  logInfo(SCOPE, rid, "request received");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = (payload ?? {}) as {
    name?: unknown;
    email?: unknown;
    situation?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const situation =
    typeof body.situation === "string" ? body.situation.trim() : "";

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
    return NextResponse.json(
      { error: "Please add a valid email." },
      { status: 400 },
    );
  }
  if (!situation || situation.length > MAX_SITUATION) {
    return NextResponse.json(
      { error: "Please describe the conversation and what you need help with." },
      { status: 400 },
    );
  }

  try {
    const record = await saveExpertRequest({ name, email, situation });
    logInfo(SCOPE, rid, "saved expert request", { id: record.id, email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(
      SCOPE,
      rid,
      `failed to save: ${err instanceof Error ? err.message : String(err)}`,
    );
    Sentry.captureException(err, { tags: { route: SCOPE, rid } });
    return NextResponse.json(
      { error: "Couldn't submit your request. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET the list (JSON). Gated by USAGE_ADMIN_TOKEN when it's set — `?token=…` or
 * an `x-admin-token` header. The human-readable view is /admin/requests.
 */
export async function GET(request: Request) {
  const required = process.env.USAGE_ADMIN_TOKEN;
  if (required) {
    const url = new URL(request.url);
    const provided =
      url.searchParams.get("token") ?? request.headers.get("x-admin-token");
    if (provided !== required) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }
  }
  return NextResponse.json({ requests: await loadExpertRequests() });
}
