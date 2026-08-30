"use client";

import type { FormEvent } from "react";
import { TONES, TONE_LABELS, type Tone } from "@/lib/types";

const QUICK_STARTS: { label: string; text: string }[] = [
  {
    label: "Asking my boss for a raise",
    text: "I want to ask my manager for a raise. I've taken on more responsibility over the past year and my pay hasn't kept up, and I want to make the case without sounding entitled.",
  },
  {
    label: "Difficult conversation with my daughter",
    text: "I need to talk with my teenage daughter about her slipping grades. I want to understand what's going on and agree on a plan, without her shutting down or feeling attacked.",
  },
  {
    label: "Pitching investors",
    text: "I'm pitching my startup to a group of investors next week. In a few minutes I need to lay out the problem, our solution, and why now is the right time — clearly and confidently.",
  },
  {
    label: "Giving a wedding toast",
    text: "I'm the best man giving a toast at my friend's wedding. I want it to be warm and a little funny, land one heartfelt moment, and not run too long.",
  },
];

interface Props {
  situation: string;
  tone: Tone | "";
  loading: boolean;
  onSituationChange: (value: string) => void;
  onToneChange: (value: Tone | "") => void;
  onSubmit: (e: FormEvent) => void;
}

export default function ScriptForm({
  situation,
  tone,
  loading,
  onSituationChange,
  onToneChange,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="situation"
          className="block text-sm font-medium text-slate-700"
        >
          What&apos;s the situation?
        </label>
        <textarea
          id="situation"
          value={situation}
          onChange={(e) => onSituationChange(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. I need to have a difficult conversation with my daughter about her grades"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Try an example:</span>
          {QUICK_STARTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onSituationChange(q.text)}
              disabled={loading}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="tone"
          className="block text-sm font-medium text-slate-700"
        >
          Tone / context <span className="text-slate-400">(optional)</span>
        </label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => onToneChange(e.target.value as Tone | "")}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">No preference</option>
          {TONES.map((t) => (
            <option key={t} value={t}>
              {TONE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading || !situation.trim()}
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate script"}
      </button>
    </form>
  );
}
