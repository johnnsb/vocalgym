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
      // Source-map upload target. All three come from the environment (see
      // .env.example) and are only needed for `next build` — never for
      // `npm run dev`. When SENTRY_AUTH_TOKEN is absent the upload is disabled
      // so a build with no Sentry credentials (CI without the secret, a
      // contributor's local prod build) still succeeds with runtime capture
      // only — stack traces just stay minified until a token is provided.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
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
