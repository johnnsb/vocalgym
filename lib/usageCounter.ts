import { prisma } from "./prisma";

/**
 * Shared request counter for the demo phase — protects against a shared link
 * running up an unexpected Anthropic bill. NOT production rate limiting: it's a
 * single global count with no per-user/IP tracking.
 *
 * Backed by a single `UsageCounter` row (id = 1) in Postgres, so it's durable
 * across restarts / serverless cold starts and the increment is atomic.
 */

const ROW_ID = 1;

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

function status(count: number, limit: number): UsageStatus {
  return {
    count,
    limit,
    limited: limit > 0 && count >= limit,
    remaining: limit > 0 ? Math.max(0, limit - count) : null,
  };
}

async function readCount(): Promise<number> {
  try {
    const row = await prisma.usageCounter.findUnique({ where: { id: ROW_ID } });
    return row?.count ?? 0;
  } catch {
    // DB unreachable — treat as 0 so the cap never *blocks* on an outage.
    return 0;
  }
}

/** Read the current usage without changing it (for the admin endpoint). */
export async function getUsage(): Promise<UsageStatus> {
  return status(await readCount(), usageLimit());
}

/**
 * Call once per billable request, before hitting Anthropic.
 * - `allowed: false` → the limit was already reached; NOT counted, caller bails.
 * - `allowed: true`  → counted; proceed.
 */
export async function recordRequest(): Promise<
  { allowed: boolean } & UsageStatus
> {
  const limit = usageLimit();

  let count: number;
  try {
    const row = await prisma.usageCounter.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, count: 1 },
      update: { count: { increment: 1 } },
    });
    count = row.count;
  } catch (err) {
    // Never fail a request because the counter is down.
    console.warn(
      `[vocalgym] usage counter unavailable, allowing request: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { allowed: true, ...status(0, limit) };
  }

  if (limit > 0 && count > limit) {
    // We just incremented past the limit — undo it and block.
    try {
      await prisma.usageCounter.update({
        where: { id: ROW_ID },
        data: { count: { decrement: 1 } },
      });
    } catch {
      /* best effort */
    }
    console.warn(
      `[vocalgym] demo request blocked — at limit ${limit}/${limit}`,
    );
    return { allowed: false, ...status(limit, limit) };
  }

  console.log(`[vocalgym] demo usage ${count}/${limit || "∞"}`);
  return { allowed: true, ...status(count, limit) };
}
