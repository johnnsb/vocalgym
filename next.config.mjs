import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 needs this opt-in for instrumentation.ts (default in Next 15).
  experimental: { instrumentationHook: true },
};

// Source-map upload needs all three of org, project, and auth token — with the
// token alone the plugin would try to upload to an undefined target. So the
// upload is enabled only when every one of them is set.
const sourceMapUploadConfigured = Boolean(
  process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    process.env.SENTRY_AUTH_TOKEN,
);

// Only wire in the Sentry build plugin when a DSN is configured, so the client
// bundle stays lean until error tracking is actually turned on. Add the DSN and
// rebuild to activate it.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      // Source-map upload target. All three come from the environment (see
      // .env.example) and are only needed for `next build` — never for
      // `npm run dev`. Unless all three are set the upload is disabled, so a
      // build with missing or partial Sentry credentials (CI without the
      // secret, a contributor's local prod build) still succeeds with runtime
      // capture only — stack traces just stay minified.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !sourceMapUploadConfigured },
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
