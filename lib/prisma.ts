import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient. In dev, Next's HMR re-evaluates modules on every
// edit, which would otherwise spawn a new client (and a new connection pool)
// each time — so we stash it on globalThis and reuse it.
//
// The datasource `url` is DATABASE_URL_POOLED (schema.prisma), so every query
// this client runs goes through the pooled connection.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
