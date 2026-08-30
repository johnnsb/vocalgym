"use client";

import { useState } from "react";
import type { PracticeAttempt } from "@/lib/types";
import FeedbackSections from "./FeedbackSections";
import NonverbalSummary from "./NonverbalSummary";
import EffectiveScore from "./EffectiveScore";

function formatStamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function previewOf(feedback: string): string {
  const lines = feedback
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  for (const line of lines) {
    if (!line || /^#{1,6}\s+/.test(line)) continue;
    const bold = line.match(/^\*\*(.+?)\*\*\s*(?:[:：]|[—–-])?\s*(.*)$/);
    if (bold) {
      const rest = bold[2].trim();
      if (rest) return rest.replace(/[*#]/g, "");
      continue;
    }
    return line.replace(/[*#]/g, "");
  }
  return "";
}

interface Props {
  attempts: PracticeAttempt[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function PastAttempts({ attempts, onDelete, onClearAll }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          Past attempts
          {attempts.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              {attempts.length}
            </span>
          )}
        </h2>
        {attempts.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
          >
            Clear all
          </button>
        )}
      </div>

      {attempts.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs leading-relaxed text-slate-400">
          Your practice attempts will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          {attempts.map((attempt) => (
            <AttemptRow
              key={attempt.id}
              attempt={attempt}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttemptRow({
  attempt,
  onDelete,
}: {
  attempt: PracticeAttempt;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`mt-0.5 h-3.5 w-3.5 flex-none text-slate-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 4.3a.75.75 0 011.06.02l5 5.25a.75.75 0 010 1.04l-5 5.25a.75.75 0 11-1.08-1.04L11.94 10 7.23 5.36a.75.75 0 01-.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {formatStamp(attempt.createdAt)}
            </span>
            {attempt.effective && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                Effective {attempt.effective.score}
              </span>
            )}
          </span>
          {!open && (
            <span className="mt-0.5 block truncate text-xs text-slate-600">
              {previewOf(attempt.feedback)}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {attempt.situation && (
            <p className="text-xs italic text-slate-400">{attempt.situation}</p>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              What you said
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
              {attempt.transcript}
            </p>
          </div>
          {attempt.effective &&
            attempt.effective.rows.some((r) => r.score !== null) && (
              <EffectiveScore result={attempt.effective} compact />
            )}
          {attempt.nonverbal && (
            <NonverbalSummary metrics={attempt.nonverbal} compact />
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Coaching notes
            </p>
            <FeedbackSections feedback={attempt.feedback} compact />
          </div>
          <button
            type="button"
            onClick={() => onDelete(attempt.id)}
            className="text-xs text-slate-400 underline underline-offset-2 transition hover:text-red-600"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
