"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PracticeRecorder, {
  speechRecognitionSupported,
} from "./PracticeRecorder";
import PracticeFeedback from "./PracticeFeedback";
import type {
  PracticeAttempt,
  PracticeFeedbackResponse,
  Tone,
} from "@/lib/types";
import {
  clearAttempts,
  deleteAttempt,
  loadAttempts,
  loadCurrentScript,
  newId,
  saveAttempt,
} from "@/lib/practiceStore";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

export default function PracticeSession() {
  const [hydrated, setHydrated] = useState(false);
  const [script, setScript] = useState("");
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Tone | "">("");
  const [editingScript, setEditingScript] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);

  useEffect(() => {
    const stored = loadCurrentScript();
    if (stored) {
      setScript(stored.script);
      setSituation(stored.situation);
      setTone(stored.tone);
    } else {
      setEditingScript(true);
    }
    setAttempts(loadAttempts());
    setHydrated(true);
  }, []);

  const speechSupported = useMemo(
    () => hydrated && speechRecognitionSupported(),
    [hydrated],
  );

  async function getFeedback() {
    const trimmedScript = script.trim();
    const trimmedTranscript = transcript.trim();
    if (!trimmedScript) {
      setError("Add a script to practice against first.");
      return;
    }
    if (!trimmedTranscript) {
      setError("Record or type your attempt before asking for feedback.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/practice-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: trimmedScript,
          transcript: trimmedTranscript,
          situation,
          tone,
        }),
      });
      const data = (await res.json()) as PracticeFeedbackResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      setFeedback(data.feedback);

      const attempt: PracticeAttempt = {
        id: newId(),
        createdAt: Date.now(),
        script: trimmedScript,
        situation,
        tone,
        transcript: trimmedTranscript,
        feedback: data.feedback,
      };
      setAttempts(saveAttempt(attempt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }

  function removeAttempt(id: string) {
    setAttempts(deleteAttempt(id));
  }

  function removeAllAttempts() {
    clearAttempts();
    setAttempts([]);
  }

  if (!hydrated) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {/* Script */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your script</h2>
          {script.trim() && (
            <button
              type="button"
              onClick={() => setEditingScript((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {editingScript ? "Done" : "Edit"}
            </button>
          )}
        </div>

        {editingScript ? (
          <div className="space-y-3">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={12}
              maxLength={8000}
              placeholder="Paste a script here, or generate one on the home page."
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <input
              type="text"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              maxLength={2000}
              placeholder="One line of context about the situation (optional)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {!script.trim() && (
              <p className="text-sm text-slate-500">
                No script yet.{" "}
                <Link href="/" className="font-medium underline">
                  Generate one
                </Link>{" "}
                and it&apos;ll show up here automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {script}
          </div>
        )}
      </section>

      {/* Record */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Rehearse it out loud</h2>
          <Link href="/" className="text-sm text-slate-500 underline">
            Back to generator
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          Read the script, then say it in your own words while recording. When you
          stop, review the transcript and ask for coaching notes.
        </p>

        <PracticeRecorder
          disabled={loading}
          onComplete={({ transcript: t, audioUrl: url }) => {
            setAudioUrl(url);
            if (t) setTranscript((prev) => (prev.trim() ? `${prev}\n${t}` : t));
          }}
        />

        <div>
          <label
            htmlFor="transcript"
            className="block text-sm font-medium text-slate-700"
          >
            What you said
            {!speechSupported && (
              <span className="ml-2 font-normal text-slate-400">
                (speech-to-text unavailable in this browser — type it here)
              </span>
            )}
          </label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            maxLength={12000}
            placeholder="Your recorded words appear here. Edit as needed before asking for feedback."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {transcript.trim() && (
            <button
              type="button"
              onClick={() => {
                setTranscript("");
                setAudioUrl(null);
              }}
              className="mt-1 text-xs text-slate-500 underline"
            >
              Clear transcript
            </button>
          )}
        </div>

        {audioUrl && (
          <p className="text-xs text-slate-400">
            Audio playback is available above until you leave this page — it
            isn&apos;t saved.
          </p>
        )}

        <button
          type="button"
          onClick={getFeedback}
          disabled={loading || !script.trim() || !transcript.trim()}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Getting feedback…" : "Get feedback"}
        </button>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {feedback && !error && <PracticeFeedback feedback={feedback} />}

      {/* History */}
      {attempts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Past attempts ({attempts.length})
            </h2>
            <button
              type="button"
              onClick={removeAllAttempts}
              className="text-sm text-slate-500 underline"
            >
              Clear all
            </button>
          </div>

          <ul className="space-y-3">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    {formatDate(a.createdAt)}
                    {a.situation ? ` · ${a.situation}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttempt(a.id)}
                    className="text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    Delete
                  </button>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Transcript
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {a.transcript}
                  </p>
                </details>
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Coaching notes
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    {a.feedback}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
