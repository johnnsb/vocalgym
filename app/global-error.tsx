"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/clientErrors";

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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <main className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-2xl font-bold tracking-tight">
            Something broke on our end
          </h1>
          <p className="mt-2 text-slate-600">
            The error has been logged. Try again, and refresh if it sticks.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
