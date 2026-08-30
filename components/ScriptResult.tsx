"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  script: string;
  loading: boolean;
  /** Omitted for uploaded scripts — there's nothing to regenerate. */
  onRegenerate?: () => void;
}

export default function ScriptResult({ script, loading, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your script</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {script}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500">Ready to rehearse it out loud?</p>
        <Link
          href="/practice"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Practice this script →
        </Link>
      </div>
    </section>
  );
}
