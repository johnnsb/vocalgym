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
  addAttempt,
  clearAttempts,
  deleteAttempt,
  loadState,
  resolveRubric,
} from "@/lib/practiceStore";
import {
  ATTRIBUTE_RUBRIC,
  computeEffective,
  computeSignals,
  rubricPreset,
} from "@/lib/rubric";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import FeedbackWidget from "./FeedbackWidget";
import { Button, Callout, Card, Input, Textarea } from "@/components/ui";

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
  const scriptMetaRef = useRef<{ id: string | null; label: string | null }>({
    id: null,
    label: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled) return;
        const stored = state.currentScript;
        if (stored) {
          setScript(stored.script);
          setSituation(stored.situation);
          setTone(stored.tone);
          scriptMetaRef.current = {
            id: stored.id ?? null,
            label: stored.label ?? null,
          };
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
        setRubric(resolveRubric(state));
        setAttempts(state.attempts);
      })
      .catch((err) => {
        reportClientError(err, { area: "practice:hydrate" });
        if (cancelled) return;
        setEditingScript(true);
        setRubric(rubricPreset(""));
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
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

      try {
        const saved = await addAttempt({
          script: trimmedScript,
          situation,
          tone,
          transcript: trimmedTranscript,
          feedback: data.feedback,
          nonverbal,
          effective,
          scriptId: scriptMetaRef.current.id,
          scriptLabel: scriptMetaRef.current.label,
        });
        setAttempts((prev) => [saved, ...prev].slice(0, 50));
      } catch (saveErr) {
        // Non-fatal — the coaching is already on screen; just log the miss.
        reportClientError(saveErr, { area: "practice:save-attempt" });
      }
    } catch (err) {
      reportClientError(err, { area: "practice-feedback:client" });
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }

  function removeAttempt(id: string) {
    setAttempts((prev) => prev.filter((a) => a.id !== id)); // optimistic
    deleteAttempt(id).catch((err) => {
      reportClientError(err, { area: "practice:delete-attempt" });
      loadState(true)
        .then((s) => setAttempts(s.attempts))
        .catch(() => {});
    });
  }

  function removeAllAttempts() {
    setAttempts([]); // optimistic
    clearAttempts().catch((err) => {
      reportClientError(err, { area: "practice:clear-attempts" });
      loadState(true)
        .then((s) => setAttempts(s.attempts))
        .catch(() => {});
    });
  }

  if (!hydrated) {
    return <p className="text-body-sm text-text-muted">Loading…</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0 space-y-8">
        {rubric && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border-subtle bg-surface-card px-4 py-3 text-body-sm shadow-sm">
            <span className="font-medium text-text-primary">
              Scoring this take on:
            </span>
            {rubric.attributes.map((a, i) => (
              <span key={a} className="text-text-body">
                {i > 0 && <span className="text-fog"> · </span>}
                {ATTRIBUTE_RUBRIC[a].label}{" "}
                <span className="text-text-muted">{rubric.weights[a]}%</span>
              </span>
            ))}
            <span className="text-caption text-text-muted">
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
              className="ml-auto text-caption text-text-muted underline underline-offset-2 transition hover:text-text-body"
            >
              change
            </button>
          </div>
        )}

        {/* Script reference */}
        <Card as="section" padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-h4 text-text-primary">Your script</h2>
            {script.trim() && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingScript((v) => !v)}
              >
                {editingScript ? "Done" : "Edit"}
              </Button>
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
                className="w-full rounded-control border border-border-default bg-surface-card px-3 py-2 font-mono text-caption leading-relaxed shadow-inset-sunken outline-none focus:border-ember"
              />
              <Input
                type="text"
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                maxLength={2000}
                placeholder="One line of context about the situation (optional)"
              />
              {!script.trim() && (
                <p className="text-body-sm text-text-muted">
                  No script yet.{" "}
                  <Link
                    href="/"
                    className="font-medium text-text-accent underline"
                  >
                    Generate one
                  </Link>{" "}
                  and it&apos;ll show up here automatically.
                </p>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
              {script}
            </div>
          )}
        </Card>

        {/* Record + transcript */}
        <Card as="section" padding="lg">
          <div className="space-y-6">
            <div>
              <h2 className="text-h4 text-text-primary">Rehearse it out loud</h2>
              <p className="mt-1.5 text-body-sm leading-relaxed text-text-body">
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
                className="block text-body-sm font-medium text-text-primary"
              >
                What you said
                {!speechSupported && (
                  <span className="ml-2 font-normal text-text-muted">
                    (speech-to-text unavailable in this browser — type it here)
                  </span>
                )}
              </label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={6}
                maxLength={12000}
                placeholder="Your recorded words appear here. Edit as needed before asking for feedback."
                style={{ marginTop: 6 }}
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
                  className="mt-1.5 text-caption text-text-muted underline"
                >
                  Clear transcript
                </button>
              )}
            </div>

            {audioUrl && (
              <p className="text-caption text-text-muted">
                Audio playback is available above until you leave this page — it
                isn&apos;t saved.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button
                onClick={getFeedback}
                disabled={loading || !script.trim() || !transcript.trim()}
              >
                {loading ? "Getting feedback…" : "Get feedback"}
              </Button>
            </div>

            {demoLimited && (
              <Callout tone="caution">
                This demo has hit its usage limit for now. Thanks for trying
                VocalGym — please check back later.
              </Callout>
            )}

            {error && !demoLimited && (
              <Callout tone="critical">{error}</Callout>
            )}
          </div>
        </Card>

        {effective && effective.rows.some((r) => r.score !== null) && (
          <EffectiveScore result={effective} signals={signals} />
        )}

        {nonverbal && <NonverbalSummary metrics={nonverbal} />}

        {feedback && !error && (
          <>
            <PracticeFeedback feedback={feedback} />
            <FeedbackWidget
              surveyKey="practice_feedback_rating"
              surveyName="Practice feedback rating"
              question="How was this feedback?"
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
