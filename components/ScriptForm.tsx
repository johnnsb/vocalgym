"use client";

import type { FormEvent } from "react";
import { TONES, type Tone } from "@/lib/types";

interface Props {
  situation: string;
  tone: Tone | "";
  loading: boolean;
  onSituationChange: (value: string) => void;
  onToneChange: (value: Tone | "") => void;
  onSubmit: (e: FormEvent) => void;
}

const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  personal: "Personal",
  "high-stakes": "High-stakes",
  supportive: "Supportive",
  persuasive: "Persuasive",
  celebratory: "Celebratory",
};

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
