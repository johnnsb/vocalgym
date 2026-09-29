"use client";

import { useEffect, useRef, useState } from "react";
import PanelSetup from "./PanelSetup";
import InterviewRound from "./InterviewRound";
import InterviewFeedbackSections from "./InterviewFeedbackSections";
import FeedbackWidget from "./FeedbackWidget";
import { DEMO_LIMIT_MESSAGE, postJSON, type FetchError } from "@/lib/clientFetch";
import { loadInterviewPrep, saveInterviewPrep } from "@/lib/interviewPrepStore";
import { emptyPrep, hasPanelContent, panelistLabel } from "@/lib/interviewPrep";
import { reportClientError } from "@/lib/clientErrors";
import { EVENTS, track } from "@/lib/analytics";
import type {
  InterviewExchange,
  InterviewFeedbackResponse,
  InterviewFollowUpResponse,
  InterviewPrepState,
  InterviewQuestionsResponse,
  PlannedQuestion,
} from "@/lib/types";
import { Button, Callout, Card } from "@/components/ui";

// /prep/interview: setup (persisted panel) -> planning -> round (each planned
// question, at most one adaptive follow-up) -> feedback. Rounds are NOT
// persisted in v0: a refresh returns to setup with the panel intact.

type Stage =
  | "loading"
  | "setup"
  | "planning"
  | "round"
  | "followup-loading"
  | "feedback-loading"
  | "feedback";

const SAVE_DEBOUNCE_MS = 800;

export default function InterviewSession() {
  const [stage, setStage] = useState<Stage>("loading");
  const [prep, setPrep] = useState<InterviewPrepState>(emptyPrep);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);

  const [plan, setPlan] = useState<PlannedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [onFollowUp, setOnFollowUp] = useState(false);
  const [exchanges, setExchanges] = useState<InterviewExchange[]>([]);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const startedAt = useRef(0);
  const completedTracked = useRef(false);
  // JSON of the last state known to be on the server — auto-save only fires
  // when the form actually differs from it (so hydration and stage changes
  // never trigger a redundant PUT, and the first real edit always saves).
  const lastSaved = useRef("");

  // Hydrate the saved panel once.
  useEffect(() => {
    loadInterviewPrep()
      .then((p) => {
        lastSaved.current = JSON.stringify(p);
        setPrep(p);
      })
      .catch((err) => {
        reportClientError(err, { area: "interview:load" });
        lastSaved.current = JSON.stringify(emptyPrep());
        setSaveWarning("Couldn't load your saved panel — starting fresh.");
      })
      .finally(() => setStage("setup"));
  }, []);

  function persist(state: InterviewPrepState) {
    const snapshot = JSON.stringify(state);
    return saveInterviewPrep(state)
      .then(() => {
        lastSaved.current = snapshot;
        setSaveWarning(null);
      })
      .catch((err) => {
        reportClientError(err, { area: "interview:save" });
        setSaveWarning(
          "Couldn't save your panel. You can still practice; changes may not be there next time.",
        );
      });
  }

  // Debounced auto-save while editing.
  useEffect(() => {
    if (stage !== "setup" || JSON.stringify(prep) === lastSaved.current) return;
    const t = setTimeout(() => void persist(prep), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, stage]);

  function fail(err: unknown, area: string, revertTo: Stage) {
    if ((err as FetchError)?.demoLimited) setDemoLimited(true);
    else {
      reportClientError(err, { area });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStage(revertTo);
  }

  async function startRound() {
    setError(null);
    setDemoLimited(false);
    setStage("planning");
    if (JSON.stringify(prep) !== lastSaved.current) void persist(prep);
    track(EVENTS.interviewSetupSaved, {
      panel_size: prep.panel.length,
      has_jd: Boolean(prep.candidate.jobDescription.trim()),
      has_background: Boolean(prep.candidate.background.trim()),
      key_points_count: prep.candidate.keyPoints.length,
    });
    try {
      const data = await postJSON<InterviewQuestionsResponse>("/api/interview-questions", prep);
      setPlan(data.questions);
      setIndex(0);
      setOnFollowUp(false);
      setExchanges([]);
      setTranscript("");
      setFeedback(null);
      startedAt.current = Date.now();
      completedTracked.current = false;
      track(EVENTS.interviewRoundStarted, {
        panel_size: prep.panel.length,
        question_count: data.questions.length,
      });
      setStage("round");
    } catch (err) {
      fail(err, "interview:questions", "setup");
    }
  }

  function advance(ex: InterviewExchange[]) {
    if (index + 1 < plan.length) {
      setIndex(index + 1);
      setOnFollowUp(false);
      setTranscript("");
      setStage("round");
    } else {
      void getFeedback(ex);
    }
  }

  async function submitAnswer() {
    const answer = transcript.trim();
    if (!answer) return;
    setError(null);

    if (onFollowUp) {
      const ex = exchanges.map((e, i) =>
        i === exchanges.length - 1 ? { ...e, followUpTranscript: answer } : e,
      );
      setExchanges(ex);
      advance(ex);
      return;
    }

    const planned = plan[index];
    const ex = [
      ...exchanges,
      { panelistId: planned.panelistId, question: planned.question, transcript: answer },
    ];
    setExchanges(ex);
    setStage("followup-loading");
    try {
      const data = await postJSON<InterviewFollowUpResponse>("/api/interview-followup", {
        ...prep,
        panelistId: planned.panelistId,
        question: planned.question,
        transcript: answer,
        upcomingQuestions: plan.slice(index + 1).map((q) => q.question),
      });
      if (data.followUp) {
        const withFollowUp = ex.map((e, i) =>
          i === ex.length - 1 ? { ...e, followUp: data.followUp ?? undefined } : e,
        );
        setExchanges(withFollowUp);
        setOnFollowUp(true);
        setTranscript("");
        setStage("round");
        return;
      }
      advance(ex);
    } catch (err) {
      // A follow-up is optional — any failure just moves on to the next
      // question (the answer is already recorded in `ex`, so staying put
      // would let a second Continue record it twice).
      if ((err as FetchError)?.demoLimited) setDemoLimited(true);
      else reportClientError(err, { area: "interview:followup" });
      advance(ex);
    }
  }

  async function getFeedback(ex: InterviewExchange[]) {
    if (ex.length === 0) return;
    setError(null);
    setDemoLimited(false);
    setStage("feedback-loading");
    if (!completedTracked.current) {
      completedTracked.current = true;
      track(EVENTS.interviewRoundCompleted, {
        answered: ex.length,
        followups: ex.filter((e) => e.followUpTranscript).length,
        ended_early: ex.length < plan.length,
        duration_sec: Math.round((Date.now() - startedAt.current) / 1000),
      });
    }
    try {
      const data = await postJSON<InterviewFeedbackResponse>("/api/interview-feedback", {
        ...prep,
        exchanges: ex,
      });
      setFeedback(data.feedback);
      track(EVENTS.interviewFeedbackReceived);
      setStage("feedback");
    } catch (err) {
      setFeedback(null);
      fail(err, "interview:feedback", "feedback");
    }
  }

  function editPanel() {
    setError(null);
    setDemoLimited(false);
    setStage("setup");
  }

  const notices = (
    <>
      {demoLimited && <Callout tone="caution">{DEMO_LIMIT_MESSAGE}</Callout>}
      {error && !demoLimited && <Callout tone="critical">{error}</Callout>}
    </>
  );

  if (stage === "loading") {
    return (
      <Card>
        <p className="text-body-sm text-text-muted">Loading your panel…</p>
      </Card>
    );
  }

  if (stage === "setup") {
    return (
      <div className="space-y-6">
        {saveWarning && <Callout tone="caution">{saveWarning}</Callout>}
        <PanelSetup value={prep} onChange={setPrep} />
        {notices}
        <Button onClick={startRound} disabled={!hasPanelContent(prep)} iconAfter="arrow-right">
          Start mock interview
        </Button>
        {!hasPanelContent(prep) && (
          <p className="text-caption text-text-muted">
            Add something about at least one interviewer to start.
          </p>
        )}
      </div>
    );
  }

  if (stage === "planning" || stage === "followup-loading" || stage === "feedback-loading") {
    return (
      <Card>
        <p className="text-body-sm text-text-muted">
          {stage === "planning" && "Reading up on your panel and planning the interview…"}
          {stage === "followup-loading" && "Thinking…"}
          {stage === "feedback-loading" && "Putting together your feedback…"}
        </p>
      </Card>
    );
  }

  if (stage === "round") {
    const planned = plan[index];
    const question = onFollowUp ? exchanges[exchanges.length - 1]?.followUp ?? "" : planned.question;
    const pIndex = prep.panel.findIndex((p) => p.id === planned.panelistId);
    const askedBy = pIndex === -1 ? "The interviewer" : panelistLabel(prep.panel[pIndex], pIndex);
    return (
      <div className="space-y-4">
        <InterviewRound
          askedBy={askedBy}
          question={question}
          isFollowUp={onFollowUp}
          number={index + 1}
          total={plan.length}
          transcript={transcript}
          onTranscript={setTranscript}
          onSubmit={submitAnswer}
          canEndEarly={exchanges.length > 0}
          onEndEarly={() => void getFeedback(exchanges)}
        />
        {notices}
      </div>
    );
  }

  // stage === "feedback"
  return (
    <div className="space-y-6">
      {feedback ? (
        <Card padding="lg">
          <h2 className="mb-5 text-h4 text-text-primary">How it went</h2>
          <InterviewFeedbackSections feedback={feedback} />
        </Card>
      ) : (
        <Card className="space-y-4">
          {notices}
          <Button onClick={() => void getFeedback(exchanges)} icon="rotate-ccw">
            Try the feedback again
          </Button>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={startRound}>Run another round</Button>
        <Button variant="secondary" onClick={editPanel}>
          Edit panel
        </Button>
      </div>
      {feedback && (
        <FeedbackWidget
          surveyKey="interview_feedback_rating"
          surveyName="Interview feedback"
          question="How useful was this mock interview?"
        />
      )}
    </div>
  );
}
