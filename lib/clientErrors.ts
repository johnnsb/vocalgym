// Report an unexpected client-side error to Sentry. When NEXT_PUBLIC_SENTRY_DSN
// is unset this whole function is dead-code-eliminated at build time (the env
// var is inlined), so the Sentry browser SDK is never pulled into the bundle.

export function reportClientError(
  err: unknown,
  tags?: Record<string, string>,
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(err, tags ? { tags } : undefined);
    })
    .catch(() => {
      /* Sentry failed to load — nothing we can do about it here */
    });
}
