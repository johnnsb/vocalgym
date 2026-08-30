import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 needs this opt-in for instrumentation.ts (default in Next 15).
  experimental: { instrumentationHook: true },
};

// Only wire in the Sentry build plugin when a DSN is configured, so the client
// bundle stays lean until error tracking is actually turned on. Add the DSN and
// rebuild to activate it.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      // No org/project/authToken configured -> runtime capture only; the build
      // never tries to upload source maps.
      sourcemaps: { disable: true },
      // Plain error capture only — no tracing / session replay. Also strips
      // Sentry's own debug logging from the bundle.
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },
    })
  : nextConfig;
