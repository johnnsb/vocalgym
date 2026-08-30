import { promises as fs } from "fs";
import path from "path";

/**
 * Dead-simple shared request counter for the demo phase — protects against a
 * shared link running up an unexpected Anthropic bill. NOT production rate
 * limiting: it's a single global count with no per-user/IP tracking, and under
 * concurrency it can overshoot the limit by a few.
 *
 * Persistence is a JSON file so the count survives a server restart. That works
 * for local `next start` and long-running/self-hosted deploys. On Vercel's
 * serverless filesystem the file isn't durable across cold starts — point
 * USAGE_COUNTER_FILE at /tmp for per-instance protection, or swap in Vercel KV.
 */

const COUNTER_FILE =
  process.env.USAGE_COUNTER_FILE ||
  path.join(process.cwd(), ".vocalgym-usage.json");

export function usageLimit(): number {
  const raw = Number(process.env.DEMO_REQUEST_LIMIT ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0; // 0 = no limit
}

export interface UsageStatus {
  count: number;
  limit: number; // 0 means unlimited
  limited: boolean; // true once count has reached the limit
  remaining: number | null; // null when unlimited
}

async function readCount(): Promise<number> {
  try {
    const parsed = JSON.parse(await fs.readFile(COUNTER_FILE, "utf8")) as {
      count?: unknown;
    };
    const n = parsed.count;
    return typeof n === "number" && Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : 0;
  } catch {
    return 0;
  }
}

async function writeCount(count: number): Promise<void> {
  try {
    await fs.writeFile(
      COUNTER_FILE,
      JSON.stringify({ count, updatedAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  } catch {
    // read-only FS (e.g. Vercel) — the counter just won't persist; never fail
    // the request over it.
  }
}

function status(count: number, limit: number): UsageStatus {
  return {
    count,
    limit,
    limited: limit > 0 && count >= limit,
    remaining: limit > 0 ? Math.max(0, limit - count) : null,
  };
}

/** Read the current usage without changing it (for the admin endpoint). */
export async function getUsage(): Promise<UsageStatus> {
  return status(await readCount(), usageLimit());
}

/**
 * Call once per billable request, before hitting Anthropic.
 * - `allowed: false` → the limit was already reached; the request was NOT
 *   counted and the caller should bail out without calling the model.
 * - `allowed: true`  → counted; proceed.
 */
export async function recordRequest(): Promise<
  { allowed: boolean } & UsageStatus
> {
  const limit = usageLimit();
  const count = await readCount();

  if (limit > 0 && count >= limit) {
    console.warn(`[vocalgym] demo request blocked — at limit ${count}/${limit}`);
    return { allowed: false, ...status(count, limit) };
  }

  const next = count + 1;
  await writeCount(next);
  console.log(`[vocalgym] demo usage ${next}/${limit || "∞"}`);
  return { allowed: true, ...status(next, limit) };
}
