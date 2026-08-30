"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PracticeRecorder, {
  speechRecognitionSupported,
} from "./PracticeRecorder";
import PracticeFeedback from "./PracticeFeedback";
import PastAttempts from "./PastAttempts";
import NonverbalSummary from "./NonverbalSummary";
import EffectiveScore from "./EffectiveScore";
import {
  TONE_LABELS,
  type AudioSummary,
  type EffectiveResult,
  type NonverbalMetrics,
  type ObservableSignals,
  type PracticeAttempt,
  type PracticeFeedbackResponse,
  type RubricSelection,
  type Tone,
} from "@/lib/types";
import {
  clearAttempts,
  deleteAttempt,
  loadAttempts,
  loadCurrentScript,
  resolveRubric,
  newId,
  saveAttempt,
} from "@/lib/practiceStore";
import { ATTRIBUTE_RUBRIC, computeEffective, computeSignals } from "@/lib/rubric";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import FeedbackWidget from "./FeedbackWidget";

export default function PracticeSession() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [script, setScript] = useState("");
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Tone | "">("");
  const [editingScript, setEditingScript] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [nonverbal, setNonverbal] = useState<NonverbalMetrics | null>(null);
  const [signals, setSignals] = useState<ObservableSignals | null>(null);
  const [effective, setEffective] = useState<EffectiveResult | null>(null);

  const [rubric, setRubric] = useState<RubricSelection | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const sessionTracked = useRef(false);

  useEffect(() => {
    const stored = loadCurrentScript();
    if (stored) {
      setScript(stored.script);
      setSituation(stored.situation);
      setTone(stored.tone);
      // Event only — no script text. Marks entry into the practice step.
      // Ref-guarded so StrictMode's double mount doesn't double-count.
      if (!sessionTracked.current) {
        sessionTracked.current = true;
        track(EVENTS.practiceSessionStarted, {
          tone: stored.tone || "none",
          source: stored.source || "unknown",
        });
      }
    } else {
      setEditingScript(true);
    }
    setRubric(resolveRubric());
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
    setDemoLimited(false);
    try {
      const res = await fetch("/api/practice-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: trimmedScript,
          transcript: trimmedTranscript,
          situation,
          tone,
          nonverbal,
          rubric,
          signals,
        }),
      });
      const data = (await res.json()) as PracticeFeedbackResponse & {
        error?: string;
        code?: string;
      };
      if (res.status === 429 && data.code === "demo_limit_reached") {
        setDemoLimited(true);
        setFeedback(null);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status}).`);
      }
      setFeedback(data.feedback);
      // Event only — the coaching text is never sent, just that it arrived
      // plus the derived score band.
      track(EVENTS.feedbackReceived, {
        used_video: nonverbal != null,
        effective_score: effective ? Math.round(effective.score) : null,
        effective_band: effective ? effective.label : null,
      });

      const attempt: PracticeAttempt = {
        id: newId(),
        createdAt: Date.now(),
        script: trimmedScript,
        situation,
        tone,
        transcript: trimmedTranscript,
        feedback: data.feedback,
        nonverbal,
        effective,
      };
      setAttempts(saveAttempt(attempt));
    } catch (err) {
      reportClientError(err, { area: "practice-feedback:client" });
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0 space-y-8">
        {rubric && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <span className="font-medium text-slate-700">
              Scoring this take on:
            </span>
            {rubric.attributes.map((a, i) => (
              <span key={a} className="text-slate-600">
                {i > 0 && <span className="text-slate-300"> · </span>}
                {ATTRIBUTE_RUBRIC[a].label}{" "}
                <span className="text-slate-400">{rubric.weights[a]}%</span>
              </span>
            ))}
            <span className="text-xs text-slate-400">
              (
              {rubric.custom
                ? "custom"
                : tone
                  ? `${TONE_LABELS[tone]} preset`
                  : "balanced preset"}
              )
            </span>
            <button
              type="button"
              onClick={() => router.back()}
              className="ml-auto text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
            >
              change
            </button>
          </div>
        )}

        {/* Script reference */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
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

        {/* Record + transcript */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Rehearse it out loud</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Read the script, then say it in your own words while recording.
                When you stop, review the transcript and ask for coaching notes.
              </p>
            </div>

            <PracticeRecorder
              disabled={loading}
              script={script}
              onComplete={({
                transcript: t,
                audioUrl: url,
                durationSec,
                nonverbal: nv,
                audio,
              }) => {
                setAudioUrl(url);
                setNonverbal(nv);
                // Event only — no transcript / audio content.
                track(EVENTS.practiceSessionCompleted, {
                  used_video: nv != null,
                  duration_sec: Math.round(durationSec),
                });
                const merged = t
                  ? transcript.trim()
                    ? `${transcript}\n${t}`
                    : t
                  : transcript;
                setTranscript(merged);
                const sig = computeSignals({
                  nonverbal: nv,
                  audio,
                  transcript: merged,
                  durationSec,
                });
                setSignals(sig);
                setEffective(computeEffective(rubric, sig));
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
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {transcript.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript("");
                    setAudioUrl(null);
                    setNonverbal(null);
                    setSignals(null);
                    setEffective(null);
                  }}
                  className="mt-1.5 text-xs text-slate-500 underline"
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

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <button
                type="button"
                onClick={getFeedback}
                disabled={loading || !script.trim() || !transcript.trim()}
                className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Getting feedback…" : "Get feedback"}
              </button>
            </div>

            {demoLimited && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This demo has hit its usage limit for now. Thanks for trying
                VocalGym — please check back later.
              </p>
            )}

            {error && !demoLimited && (
              <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </section>

        {effective && effective.rows.some((r) => r.score !== null) && (
          <EffectiveScore result={effective} signals={signals} />
        )}

        {nonverbal && <NonverbalSummary metrics={nonverbal} />}

        {feedback && !error && (
          <>
            <PracticeFeedback feedback={feedback} />
            <FeedbackWidget
              surveyKey="practice_feedback_helpful"
              surveyName="Was this feedback helpful?"
              question="Was this feedback helpful?"
              variant="inline"
            />
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <PastAttempts
          attempts={attempts}
          onDelete={removeAttempt}
          onClearAll={removeAllAttempts}
        />
      </aside>
    </div>
  );
}
