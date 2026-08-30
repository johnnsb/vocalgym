"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_ENABLED, EVENTS, track } from "@/lib/analytics";

// A small, dismissible smiley-rating prompt shown at each "completion point"
// (script generated, practice feedback shown, and a general one on the landing
// page). Pick a face -> an optional note is revealed -> submit. Reports into
// PostHog Surveys via "survey sent" / "survey dismissed", carrying the rating
// and the note. Once answered or dismissed it stays hidden for that browser.
//   - variant="inline"   — a card in the page flow
//   - variant="floating" — a fixed corner pill that expands

type Variant = "inline" | "floating";

interface Props {
  surveyKey: string;
  surveyName: string;
  question: string;
  variant?: Variant;
}

type Phase = "hidden" | "prompt" | "comment" | "done";

const STORAGE_PREFIX = "vocalgym:survey:";

// 5-point frustrated -> great scale. `value` is what gets reported.
const FACES = [
  { value: 1, emoji: "😞", label: "Frustrated" },
  { value: 2, emoji: "😕", label: "Unhappy" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

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

  const chosen = FACES.find((f) => f.value === rating);

  function choose(value: number) {
    setRating(value);
    setPhase("comment");
  }

  function send() {
    const face = FACES.find((f) => f.value === rating);
    track(EVENTS.surveySent, {
      $survey_name: surveyName,
      survey_key: surveyKey,
      // numeric rating + label; the note is deliberate product feedback so it's
      // fine to include verbatim.
      $survey_response: rating,
      rating,
      rating_label: face?.label,
      scale_max: FACES.length,
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
            <div className="mt-3 flex gap-1">
              {FACES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => choose(f.value)}
                  aria-label={f.label}
                  title={f.label}
                  className="rounded-md px-1.5 py-1 text-2xl leading-none opacity-70 transition hover:scale-110 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  {f.emoji}
                </button>
              ))}
            </div>
          )}

          {phase === "comment" && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">
                {chosen?.emoji} {chosen?.label}
                {" · "}
                <button
                  type="button"
                  onClick={() => setPhase("prompt")}
                  className="underline underline-offset-2 hover:text-slate-700"
                >
                  change
                </button>
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Anything you'd like to share? (optional)"
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
                  Skip
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
