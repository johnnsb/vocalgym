"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PresentationSetup from "./PresentationSetup";
import PresentationRun, { type RunResult } from "./PresentationRun";
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
import type { PresentationFeedbackResponse, PresentationPrep, PresentationTake } from "@/lib/types";
import { Button, Callout, Card } from "@/components/ui";

// /prep/presentation: setup (persisted) -> run (one continuous take) ->
// feedback (take saved to history only after feedback succeeds).

type Stage = "loading" | "setup" | "run" | "feedback-loading" | "feedback";

const SAVE_DEBOUNCE_MS = 800;
const EMPTY_RESULT: RunResult = {
  transcript: "", durationSec: 0, nonverbal: null, signals: null, effective: null, slideTimings: null,
};

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

  // Same data-safety rules as the interview page (see lib/interviewRound.ts):
  // save only after a successful load; flush a pending save on leave.
  const loaded = useRef(false);
  const lastSaved = useRef("");
  const latestPrep = useRef(prep);
  latestPrep.current = prep;

  useEffect(() => {
    loadPresentationPrep()
      .catch(() => new Promise((r) => setTimeout(r, 1000)).then(loadPresentationPrep))
      .then((p) => {
        loaded.current = true;
        lastSaved.current = JSON.stringify(p);
        setPrep(p);
      })
      .catch((err) => {
        reportClientError(err, { area: "presentation:load" });
        setSaveWarning("Couldn't load your saved setup. You can still practice, but changes won't be saved this visit.");
      })
      .finally(() => setStage("setup"));
    loadTakes()
      .then(setTakes)
      .catch((err) => reportClientError(err, { area: "presentation:load-takes" }));
  }, []);

  function persistIfChanged(state: PresentationPrep, keepalive = false) {
    const snapshot = JSON.stringify(state);
    if (!shouldPersist({ loaded: loaded.current, snapshot, lastSaved: lastSaved.current })) return;
    if (keepalive) lastSaved.current = snapshot;
    savePresentationPrep(state, { keepalive })
      .then(() => {
        lastSaved.current = snapshot;
        setSaveWarning(null);
      })
      .catch((err) => {
        if (keepalive) return;
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
    track(EVENTS.presentationSetupSaved, {
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
    setStage("run");
  }

  async function getFeedback() {
    if (!result?.transcript.trim()) return;
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
      setStage("run");
    }
  }

  function removeTake(id: string) {
    setTakes((prev) => prev.filter((t) => t.id !== id));
    deleteTake(id).catch((err) => {
      reportClientError(err, { area: "presentation:delete-take" });
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
        <PresentationRun
          prep={prep}
          result={result}
          onResult={(r) => {
            setResult(r);
            track(EVENTS.presentationTakeCompleted, {
              used_video: r.nonverbal != null,
              duration_sec: r.durationSec,
              slide_count: prep.mode === "slides" ? prep.slides.length : 0,
            });
          }}
          onTranscript={(t) => setResult((prev) => ({ ...(prev ?? EMPTY_RESULT), transcript: t }))}
          onGetFeedback={getFeedback}
          onBack={() => setStage("setup")}
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
        {feedback && (
          <Card padding="lg">
            <h2 className="mb-5 text-h4 text-text-primary">How it went</h2>
            <PresentationFeedbackSections feedback={feedback} />
          </Card>
        )}
        {takeWarning && <Callout tone="caution">{takeWarning}</Callout>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={startRun} icon="rotate-ccw">Run it again</Button>
          <Button variant="secondary" onClick={() => setStage("setup")}>Edit setup</Button>
        </div>
        <FeedbackWidget
          surveyKey="presentation_feedback_rating"
          surveyName="Presentation feedback"
          question="How useful was this run-through feedback?"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{main}</div>
      <aside>
        <PresentationHistory takes={takes} onDelete={removeTake} />
      </aside>
    </div>
  );
}
