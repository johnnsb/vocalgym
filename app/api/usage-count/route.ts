import { NextResponse } from "next/server";
import { getUsage } from "@/lib/usageCounter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usage-count — check how close the demo counter is to its limit.
 *
 * If USAGE_ADMIN_TOKEN is set, the request must include it as `?token=...` or an
 * `x-admin-token` header. If it's not set, the endpoint is open (it only exposes
 * a request count).
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

  const usage = await getUsage();
  return NextResponse.json({
    count: usage.count,
    limit: usage.limit || null,
    remaining: usage.remaining,
    limited: usage.limited,
  });
}
