"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ANALYTICS_ENABLED,
  capturePageview,
  initAnalytics,
} from "@/lib/analytics";

// Fires a manual $pageview on every App Router navigation. `useSearchParams`
// needs a Suspense boundary, hence the wrapper below.
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    // Guard against React StrictMode's double effect invocation (and any
    // re-render that doesn't actually change the URL).
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    capturePageview(url);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Client-side analytics bootstrap. Renders nothing visible; when
 * NEXT_PUBLIC_POSTHOG_KEY is unset every call inside is a no-op.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      {ANALYTICS_ENABLED && (
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
      )}
      {children}
    </>
  );
}
