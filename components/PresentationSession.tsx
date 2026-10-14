"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PresentationSetup from "./PresentationSetup";
import PresentationRun from "./PresentationRun";
import PresentationQaStep from "./PresentationQaStep";
import {
  applyRecording,
  keepaliveSafe,
  shouldAcceptRecording,
  withTranscript,
  type RunResult,
} from "@/lib/presentationRun";
import PresentationFeedbackSections from "./PresentationFeedbackSections";
import PresentationHistory from "./PresentationHistory";
import EffectiveScore from "./EffectiveScore";
import NonverbalSummary from "./NonverbalSummary";
import FeedbackWidget from "./FeedbackWidget";
import { DEMO_LIMIT_MESSAGE, postJSON, type FetchError } from "@/lib/clientFetch";
import {
  deleteTake,
  loadPresentationPrep,
  loadTakes,
  savePresentationPrep,
  saveTake,
} from "@/lib/presentationStore";
import { emptyPresentationPrep, presentationHasContent } from "@/lib/presentationPrep";
import { shouldPersist } from "@/lib/interviewRound";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import type {
  PresentationFeedbackResponse,
  PresentationPrep,
  PresentationQA,
  PresentationQuestionsResponse,
  PresentationTake,
} from "@/lib/types";
import { Button, Callout, Card } from "@/components/ui";

// /prep/presentation: setup (persisted) -> run (one continuous take) ->
// feedback (take saved to history only after feedback succeeds).

type Stage = "loading" | "setup" | "run" | "qa-loading" | "qa" | "feedback-loading" | "feedback";

const SAVE_DEBOUNCE_MS = 800;

export default function PresentationSession() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prep, setPrep] = useState<PresentationPrep>(emptyPresentationPrep);
  const [takes, setTakes] = useState<PresentationTake[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [takeWarning, setTakeWarning] = useState<string | null>(null);
  // Opt-in audience Q&A after the run (prep.audienceQa).
  const [questions, setQuestions] = useState<string[]>([]);
  const [qaIndex, setQaIndex] = useState(0);
  const [qaAnswers, setQaAnswers] = useState<string[]>([]);
  // The Q&A sent with the last feedback request, for "Try again".
  const lastQa = useRef<PresentationQA[]>([]);
  const [takesLoadFailed, setTakesLoadFailed] = useState(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  // Same data-safety rules as the interview page (see lib/interviewRound.ts):
  // save only after a successful load; flush a pending save on leave.
  const loaded = useRef(false);
  const lastSaved = useRef("");
  const latestPrep = useRef(prep);
  latestPrep.current = prep;
  // Read inside async callbacks (a recording can finish after the run screen
  // unmounted) so a late take never overwrites the result being reviewed.
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    // `cancelled`: a superseded load (React StrictMode runs this twice in dev)
    // must not land after the user has started typing and overwrite it.
    let cancelled = false;
    loadPresentationPrep()
      .catch(() => new Promise((r) => setTimeout(r, 1000)).then(loadPresentationPrep))
      .then((p) => {
        if (cancelled) return;
        loaded.current = true;
        lastSaved.current = JSON.stringify(p);
        setPrep(p);
      })
      .catch((err) => {
        if (cancelled) return;
        reportClientError(err, { area: "presentation:load" });
        setSaveWarning("Couldn't load your saved setup. You can still practice, but changes won't be saved this visit.");
      })
      .finally(() => {
        if (!cancelled) setStage("setup");
      });
    loadTakes()
      .then((t) => {
        if (!cancelled) setTakes(t);
      })
      .catch((err) => {
        if (cancelled) return;
        reportClientError(err, { area: "presentation:load-takes" });
        setTakesLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function persistIfChanged(state: PresentationPrep, leaving = false) {
    const snapshot = JSON.stringify(state);
    if (!shouldPersist({ loaded: loaded.current, snapshot, lastSaved: lastSaved.current })) return;
    // keepalive lets the PUT outlive the page, but browsers cap its body at
    // 64KB — a larger setup falls back to a normal (best-effort) request.
    // lastSaved only advances on success, so a dropped flush is retried.
    const keepalive = leaving && keepaliveSafe(snapshot);
    savePresentationPrep(state, { keepalive })
      .then(() => {
        lastSaved.current = snapshot;
        setSaveWarning(null);
      })
      .catch((err) => {
        if (leaving) return;
        reportClientError(err, { area: "presentation:save" });
        setSaveWarning("Couldn't save your setup. You can still practice; changes may not be there next time.");
      });
  }

  useEffect(() => {
    if (stage !== "setup") return;
    const t = setTimeout(() => persistIfChanged(prep), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, stage]);

  useEffect(() => {
    const flush = () => persistIfChanged(latestPrep.current, true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startRun() {
    persistIfChanged(prep);
    track(EVENTS.presentationRunStarted, {
      mode: prep.mode,
      slide_count: prep.mode === "slides" ? prep.slides.length : 0,
      has_audience: Boolean(prep.audience.trim()),
      has_time_limit: prep.timeLimitMin != null,
    });
    setResult(null);
    setFeedback(null);
    setError(null);
    setDemoLimited(false);
    setTakeWarning(null);
    setQuestions([]);
    setQaIndex(0);
    setQaAnswers([]);
    lastQa.current = [];
    setStage("run");
  }

  async function startQa() {
    if (!result?.transcript.trim()) return;
    setError(null);
    setDemoLimited(false);
    setStage("qa-loading");
    try {
      const data = await postJSON<PresentationQuestionsResponse>("/api/presentation-questions", {
        prep,
        transcript: result.transcript,
      });
      setQuestions(data.questions);
      setQaAnswers(data.questions.map(() => ""));
      setQaIndex(0);
      setStage("qa");
    } catch (err) {
      if ((err as FetchError)?.demoLimited) setDemoLimited(true);
      else {
        reportClientError(err, { area: "presentation:questions" });
        setError(
          `${err instanceof Error ? err.message : "Something went wrong."} You can skip the questions and get feedback on the talk.`,
        );
      }
      setStage("run");
    }
  }

  /** Answered pairs before index `upTo` (skipped/unanswered ones are dropped). */
  function answeredQa(upTo = questions.length): PresentationQA[] {
    return questions
      .slice(0, upTo)
      .map((question, i) => ({ question, answer: (qaAnswers[i] ?? "").trim() }))
      .filter((x) => x.answer);
  }

  /** `skipFrom`: first question index to leave out when the user skips — it
   *  and later ones are dropped even if an answer is already typed/recorded. */
  function finishQa(skipFrom?: number) {
    const qa = answeredQa(skipFrom);
    track(EVENTS.presentationQaCompleted, { asked: questions.length, answered: qa.length });
    void getFeedback(qa);
  }

  async function getFeedback(qa: PresentationQA[] = []) {
    if (!result?.transcript.trim()) return;
    lastQa.current = qa;
    setError(null);
    setDemoLimited(false);
    setStage("feedback-loading");
    try {
      const data = await postJSON<PresentationFeedbackResponse>("/api/presentation-feedback", {
        prep,
        transcript: result.transcript,
        durationSec: result.durationSec,
        slideTimings: result.slideTimings,
        nonverbal: result.nonverbal,
        signals: result.signals,
        qa,
      });
      setFeedback(data.feedback);
      setStage("feedback");
      track(EVENTS.presentationFeedbackReceived, {
        effective_score: result.effective ? Math.round(result.effective.score) : null,
        effective_band: result.effective ? result.effective.label : null,
        used_video: result.nonverbal != null,
      });
      saveTake({
        talkTitle: prep.title,
        durationSec: result.durationSec,
        transcript: result.transcript,
        feedback: data.feedback,
        effective: result.effective,
        nonverbal: result.nonverbal,
        slideTimings: result.slideTimings,
        qa: qa.length ? qa : null,
      })
        .then((t) => setTakes((prev) => [t, ...prev].slice(0, 50)))
        .catch((err) => {
          reportClientError(err, { area: "presentation:save-take" });
          setTakeWarning("Couldn't save this run to your history.");
        });
    } catch (err) {
      if ((err as FetchError)?.demoLimited) setDemoLimited(true);
      else {
        reportClientError(err, { area: "presentation:feedback" });
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      // With answered Q&A, don't send the user back through the questions:
      // stay on the feedback screen with a retry instead.
      if (qa.length) {
        setFeedback(null);
        setStage("feedback");
      } else {
        setStage("run");
      }
    }
  }

  function removeTake(id: string) {
    setHistoryNotice(null);
    setTakes((prev) => prev.filter((t) => t.id !== id));
    deleteTake(id).catch((err) => {
      reportClientError(err, { area: "presentation:delete-take" });
      setHistoryNotice("Couldn't delete that run — it's back in your list.");
      loadTakes().then(setTakes).catch(() => {});
    });
  }

  const notices = (
    <>
      {demoLimited && <Callout tone="caution">{DEMO_LIMIT_MESSAGE}</Callout>}
      {error && !demoLimited && <Callout tone="critical">{error}</Callout>}
    </>
  );

  let main: ReactNode;
  if (stage === "loading") {
    main = (
      <Card>
        <p className="text-body-sm text-text-muted">Loading your setup…</p>
      </Card>
    );
  } else if (stage === "setup") {
    const ready = presentationHasContent(prep);
    main = (
      <div className="space-y-6">
        {saveWarning && <Callout tone="caution">{saveWarning}</Callout>}
        <PresentationSetup value={prep} onChange={setPrep} />
        <Button onClick={startRun} disabled={!ready} iconAfter="arrow-right">
          Start run-through
        </Button>
        {!ready && (
          <p className="text-caption text-text-muted">
            Add your notes, or at least one slide with a title or notes, to start.
          </p>
        )}
      </div>
    );
  } else if (stage === "run") {
    main = (
      <div className="space-y-4">
        {saveWarning && <Callout tone="caution">{saveWarning}</Callout>}
        <PresentationRun
          prep={prep}
          result={result}
          onRecording={(rec) => {
            if (!shouldAcceptRecording(stageRef.current)) return;
            setResult((prev) => applyRecording(prev, rec));
            track(EVENTS.presentationTakeCompleted, {
              used_video: rec.nonverbal != null,
              duration_sec: Math.round(rec.durationSec),
              slide_count: prep.mode === "slides" ? prep.slides.length : 0,
            });
          }}
          onTranscript={(t) => setResult((prev) => withTranscript(prev, t))}
          onGetFeedback={prep.audienceQa ? startQa : () => void getFeedback()}
          onBack={() => setStage("setup")}
          primaryLabel={prep.audienceQa ? "Continue to audience questions" : "Get feedback"}
          secondary={prep.audienceQa ? { label: "Skip questions → get feedback", onClick: () => void getFeedback() } : undefined}
        />
        {notices}
      </div>
    );
  } else if (stage === "qa-loading") {
    main = (
      <Card>
        <p className="text-body-sm text-text-muted">The audience is thinking of questions…</p>
      </Card>
    );
  } else if (stage === "qa" && questions[qaIndex]) {
    const i = qaIndex;
    main = (
      <div className="space-y-4">
        <PresentationQaStep
          question={questions[i]}
          number={i + 1}
          total={questions.length}
          answer={qaAnswers[i] ?? ""}
          onAnswer={(text) => {
            // A recording that lands after moving on must not overwrite another answer.
            if (stageRef.current !== "qa") return;
            setQaAnswers((prev) => prev.map((a, j) => (j === i ? text : a)));
          }}
          onContinue={() => (i + 1 < questions.length ? setQaIndex(i + 1) : finishQa())}
          // Matches the button labels: "Skip this one" (last question) drops the
          // on-screen answer; "Skip the rest" keeps it and drops later questions.
          onSkip={() => finishQa(i + 1 < questions.length ? i + 1 : i)}
        />
        {notices}
      </div>
    );
  } else if (stage === "feedback-loading") {
    main = (
      <Card>
        <p className="text-body-sm text-text-muted">Putting together your feedback…</p>
      </Card>
    );
  } else {
    main = (
      <div className="space-y-6">
        {result?.effective && <EffectiveScore result={result.effective} signals={result.signals} />}
        {result?.nonverbal && <NonverbalSummary metrics={result.nonverbal} />}
        {feedback ? (
          <Card padding="lg">
            <h2 className="mb-5 text-h4 text-text-primary">How it went</h2>
            <PresentationFeedbackSections feedback={feedback} />
          </Card>
        ) : (
          <Card className="space-y-4">
            {notices}
            <Button onClick={() => void getFeedback(lastQa.current)} icon="rotate-ccw">
              Try the feedback again
            </Button>
          </Card>
        )}
        {takeWarning && <Callout tone="caution">{takeWarning}</Callout>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={startRun} icon="rotate-ccw">Run it again</Button>
          <Button variant="secondary" onClick={() => setStage("setup")}>Edit setup</Button>
        </div>
        {/* Only rate feedback that was actually shown (not the retry screen). */}
        {feedback && (
          <FeedbackWidget
            surveyKey="presentation_feedback_rating"
            surveyName="Presentation feedback"
            question="How useful was this run-through feedback?"
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{main}</div>
      <aside>
        <PresentationHistory takes={takes} onDelete={removeTake} loadFailed={takesLoadFailed} notice={historyNotice} />
      </aside>
    </div>
  );
}
