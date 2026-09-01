"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/clientErrors";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { area: "global-error" });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        <main className="mx-auto max-w-narrow px-4 py-16">
          <h1 className="font-serif text-h2 text-text-primary">
            Something broke on our end
          </h1>
          <p className="mt-2 text-body text-text-body">
            The error has been logged. Try again, and refresh if it sticks.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-[var(--control-h)] items-center rounded-control bg-ember px-5 text-label font-medium text-[#FFF8EE] transition hover:bg-ember-press"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
