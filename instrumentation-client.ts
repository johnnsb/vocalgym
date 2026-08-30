import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NODE_ENV,
    enabled: true,
  });
}

// Lets the Sentry SDK attach context to client-side navigations. `?.` guards the
// case where this export isn't present in the installed build.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
