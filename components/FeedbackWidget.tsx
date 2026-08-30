"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_ENABLED, EVENTS, track } from "@/lib/analytics";

// A small, dismissible feedback prompt that reports into PostHog Surveys via the
// "survey sent" / "survey dismissed" events. Two shapes:
//   - variant="inline"   — a card dropped into the page flow (used on /practice
//                          once coaching notes are shown)
//   - variant="floating" — a fixed pill in the corner (used on the landing page
//                          for general product feedback)
// Once answered or dismissed it stays hidden for that browser.

type Variant = "inline" | "floating";

interface Props {
  surveyKey: string;
  surveyName: string;
  question: string;
  variant?: Variant;
}

type Phase = "hidden" | "prompt" | "comment" | "done";

const STORAGE_PREFIX = "vocalgym:survey:";

function readState(key: string): "open" | "closed" {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) ? "closed" : "open";
  } catch {
    return "open";
  }
}

function markClosed(key: string, how: "done" | "dismissed") {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, how);
  } catch {
    // ignore — a remembered dismissal is a nicety, not required
  }
}

export default function FeedbackWidget({
  surveyKey,
  surveyName,
  question,
  variant = "inline",
}: Props) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [open, setOpen] = useState(variant === "inline");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (readState(surveyKey) === "open") setPhase("prompt");
  }, [surveyKey]);

  // No PostHog key -> nothing to collect into, so don't show the widget.
  if (!ANALYTICS_ENABLED) return null;
  if (phase === "hidden") return null;

  function choose(value: number) {
    setRating(value);
    setPhase("comment");
  }

  function send() {
    track(EVENTS.surveySent, {
      $survey_name: surveyName,
      survey_key: surveyKey,
      // numeric rating only + whether a free-text note was added; the note
      // itself is deliberate product feedback, so it's fine to include.
      $survey_response: rating,
      has_comment: comment.trim().length > 0,
      comment: comment.trim() || undefined,
    });
    markClosed(surveyKey, "done");
    setPhase("done");
  }

  function dismiss() {
    track(EVENTS.surveyDismissed, {
      $survey_name: surveyName,
      survey_key: surveyKey,
    });
    markClosed(surveyKey, "dismissed");
    setPhase("hidden");
  }

  const body = (
    <div className="relative">
      <button
        type="button"
        onClick={variant === "floating" ? () => setOpen(false) : dismiss}
        aria-label={variant === "floating" ? "Close" : "Dismiss"}
        className="absolute right-0 top-0 rounded p-1 text-slate-400 transition hover:text-slate-600"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>

      {phase === "done" ? (
        <p className="pr-6 text-sm font-medium text-slate-700">
          Thanks for the feedback.
        </p>
      ) : (
        <>
          <p className="pr-6 text-sm font-medium text-slate-800">{question}</p>

          {phase === "prompt" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => choose(1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                👍 Yes
              </button>
              <button
                type="button"
                onClick={() => choose(0)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                👎 Not really
              </button>
            </div>
          )}

          {phase === "comment" && (
            <div className="mt-3 space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Anything else? (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={send}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={send}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
                >
                  Skip note
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (variant === "floating") {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        {open ? (
          <div className="w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            {body}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md transition hover:bg-slate-50"
          >
            Feedback
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {body}
    </div>
  );
}
