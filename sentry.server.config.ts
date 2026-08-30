import * as Sentry from "@sentry/nextjs";

// DSN is not a secret, so it uses the NEXT_PUBLIC_ prefix (see .env.example).
// When it's absent, the SDK stays disabled and every capture call is a no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV,
    enabled: true,
  });
}
