// PostHog product analytics — a thin, privacy-conservative wrapper.
//
// Design goals:
//  - Fully no-op unless NEXT_PUBLIC_POSTHOG_KEY is set (same on/off pattern as
//    the Sentry DSN). When it's blank, `posthog-js` is never even imported, so
//    it stays out of the main bundle.
//  - Navigation + engagement only. `track()` accepts primitives, never objects,
//    so a script / transcript / feedback string can't be passed by accident.
//  - Autocapture and session recording are OFF — we only send the events we
//    explicitly name here.

import type posthogType from "posthog-js";

type PostHog = typeof posthogType;

/** True only when a key is configured at build time. Guards every call below. */
export const ANALYTICS_ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let instance: PostHog | null = null;
let loading: Promise<void> | null = null;

/**
 * Load + init `posthog-js` on demand. Idempotent and safe to call from many
 * places; the dynamic import means the SDK is a separate async chunk that's
 * only fetched when analytics is actually turned on.
 */
export function initAnalytics(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (instance || loading) return;
  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: HOST,
        // We send $pageview ourselves on every route change (App Router).
        capture_pageview: false,
        // Keep automatic $pageleave so time-on-page / bounce still work.
        capture_pageleave: true,
        // No DOM-scraped clicks or input metadata — named events only.
        autocapture: false,
        disable_session_recording: true,
        // Don't create person profiles for anonymous traffic.
        person_profiles: "identified_only",
      });
      instance = posthog;
    })
    .catch(() => {
      // Analytics is best-effort; never let it break the app.
    });
}

type PrimitiveProps = Record<
  string,
  string | number | boolean | null | undefined
>;

function withPostHog(fn: (ph: PostHog) => void): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (instance) {
    fn(instance);
    return;
  }
  initAnalytics();
  loading?.then(() => {
    if (instance) fn(instance);
  });
}

/**
 * Record a named product event. Props are restricted to primitives on purpose —
 * pass counts, enums, booleans and durations, never user-authored content.
 */
export function track(event: string, props?: PrimitiveProps): void {
  withPostHog((ph) => ph.capture(event, props));
}

/** Manual pageview, called by the route-change tracker in providers.tsx. */
export function capturePageview(url: string): void {
  withPostHog((ph) => ph.capture("$pageview", { $current_url: url }));
}

/** Canonical event names, so call sites don't drift on spelling. */
export const EVENTS = {
  scriptGenerated: "script_generated",
  scriptProvided: "script_provided",
  practiceSessionStarted: "practice_session_started",
  practiceSessionCompleted: "practice_session_completed",
  feedbackReceived: "feedback_received",
  expertRequestSubmitted: "expert_request_submitted",
  surveySent: "survey sent",
  surveyDismissed: "survey dismissed",
} as const;
