"use client";

import { useRef, useState, type ChangeEvent } from "react";
import PracticeRecorder, {
  speechRecognitionSupported,
} from "./PracticeRecorder";
import QAFeedbackSections from "./QAFeedbackSections";
import { ACCEPTED_UPLOAD, extractScriptText } from "@/lib/scriptImport";
import { reportClientError } from "@/lib/clientErrors";
import type { QAExchange } from "@/lib/types";
import { Button, Callout, Card, Field, Textarea } from "@/components/ui";

// "Grill" mode: upload material -> generate likely questions -> answer one by
// voice -> Claude asks one responsive follow-up based on that actual answer ->
// answer that -> qualitative feedback on both exchanges. v0 slice: no
// persistence (nothing is saved as an Attempt), no rubric/Effective score —
// see lib/types.ts and CLAUDE.md "Open questions" for why.
type Step =
  | "upload"
  | "questions-loading"
  | "pick-question"
  | "answer-1"
  | "followup-loading"
  | "answer-2"
  | "feedback-loading"
  | "done";

const MAX_TRANSCRIPT_LENGTH = 12000;
const DEMO_LIMIT_MESSAGE =
  "This demo has hit its usage limit for now. Thanks for trying VocalGym — please check back later.";

interface FetchError extends Error {
  demoLimited?: boolean;
}

export default function GrillSession() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [demoLimited, setDemoLimited] = useState(false);

  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<string[]>([]);
  const [question1, setQuestion1] = useState<string | null>(null);
  const [transcript1, setTranscript1] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [transcript2, setTranscript2] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const speechSupported = speechRecognitionSupported();

  async function postJSON<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { error?: string; code?: string };
    if (res.status === 429 && data.code === "demo_limit_reached") {
      const err: FetchError = new Error(DEMO_LIMIT_MESSAGE);
      err.demoLimited = true;
      throw err;
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status}).`);
    }
    return data;
  }

  function fail(err: unknown, area: string, revertTo: Step) {
    if ((err as FetchError)?.demoLimited) {
      setDemoLimited(true);
    } else {
      reportClientError(err, { area });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStep(revertTo);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const { text, truncated } = await extractScriptText(file);
      setSource(text);
      setNotice(
        `Imported “${file.name}”${
          truncated ? " — trimmed to the first 8,000 characters" : ""
        }.`,
      );
    } catch (err) {
      reportClientError(err, { area: "grill:upload" });
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setUploading(false);
    }
  }

  async function generateQuestions() {
    const trimmed = source.trim();
    if (!trimmed) return;
    setStep("questions-loading");
    setError(null);
    setDemoLimited(false);
    try {
      const data = await postJSON<{ questions: string[] }>(
        "/api/generate-questions",
        { source: trimmed },
      );
      setQuestions(data.questions);
      setStep("pick-question");
    } catch (err) {
      fail(err, "grill:generate-questions", "upload");
    }
  }

  function pickQuestion(q: string) {
    setQuestion1(q);
    setTranscript1("");
    setError(null);
    setStep("answer-1");
  }

  async function getFollowUp() {
    if (!question1 || !transcript1.trim()) return;
    setStep("followup-loading");
    setError(null);
    setDemoLimited(false);
    try {
      const data = await postJSON<{ followUp: string }>(
        "/api/followup-question",
        {
          source: source.trim(),
          originalQuestion: question1,
          transcript: transcript1.trim(),
          otherQuestions: questions.filter((q) => q !== question1),
        },
      );
      setFollowUp(data.followUp);
      setTranscript2("");
      setStep("answer-2");
    } catch (err) {
      fail(err, "grill:followup-question", "answer-1");
    }
  }

  async function getFeedback() {
    if (!question1 || !followUp || !transcript1.trim() || !transcript2.trim()) {
      return;
    }
    setStep("feedback-loading");
    setError(null);
    setDemoLimited(false);
    try {
      const exchanges: QAExchange[] = [
        { question: question1, transcript: transcript1.trim() },
        { question: followUp, transcript: transcript2.trim() },
      ];
      const data = await postJSON<{ feedback: string }>("/api/qa-feedback", {
        source: source.trim(),
        exchanges,
      });
      setFeedback(data.feedback);
      setStep("done");
    } catch (err) {
      fail(err, "grill:qa-feedback", "answer-2");
    }
  }

  function startOver() {
    setStep("upload");
    setError(null);
    setDemoLimited(false);
    setSource("");
    setNotice(null);
    setQuestions([]);
    setQuestion1(null);
    setTranscript1("");
    setFollowUp(null);
    setTranscript2("");
    setFeedback(null);
  }

  const busy =
    step === "questions-loading" ||
    step === "followup-loading" ||
    step === "feedback-loading";

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <Card className="space-y-4">
          <Field label="What are you defending?" htmlFor="source">
            <Textarea
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={10}
              maxLength={8000}
              placeholder="Paste the proposal, presentation notes, or write-up you're going to be questioned on…"
              style={{ lineHeight: "var(--text-body-line)" }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-caption text-text-muted">or</span>
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Reading…" : "Upload a file"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_UPLOAD}
                onChange={handleFile}
                className="hidden"
              />
              <span className="text-caption text-text-muted">.txt, .md, or .pdf</span>
            </div>
          </Field>

          {notice && !error && <Callout tone="info">{notice}</Callout>}
          {error && <Callout tone="critical">{error}</Callout>}

          <Button
            onClick={generateQuestions}
            disabled={!source.trim() || uploading}
            iconAfter="arrow-right"
          >
            Generate questions
          </Button>
        </Card>
      )}

      {busy && (
        <Card>
          <p className="text-body-sm text-text-muted">
            {step === "questions-loading" &&
              "Reading the material and drafting likely questions…"}
            {step === "followup-loading" &&
              "Reading your answer and preparing a follow-up…"}
            {step === "feedback-loading" && "Putting together your feedback…"}
          </p>
        </Card>
      )}

      {step === "pick-question" && (
        <Card className="space-y-4">
          <p className="text-body-sm font-medium text-text-primary">
            Pick a question to answer out loud:
          </p>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <Card
                key={i}
                as="button"
                interactive
                padding="sm"
                onClick={() => pickQuestion(q)}
                className="block w-full text-left"
              >
                <span className="text-body-sm text-text-body">{q}</span>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {(step === "answer-1" || step === "answer-2") && (
        <>
          {step === "answer-2" && (
            <Callout tone="info">
              Follow-up, based on your last answer — not from the original list.
            </Callout>
          )}
          <Card className="space-y-4">
            <p className="text-body-sm font-medium text-text-primary">
              {step === "answer-1" ? question1 : followUp}
            </p>
            <PracticeRecorder
              script={step === "answer-1" ? question1 ?? "" : followUp ?? ""}
              contentLabel={step === "answer-1" ? "Question" : "Follow-up question"}
              onComplete={({ transcript }) => {
                if (step === "answer-1") setTranscript1(transcript);
                else setTranscript2(transcript);
              }}
            />

            <div>
              <label
                htmlFor="grill-transcript"
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
                id="grill-transcript"
                value={step === "answer-1" ? transcript1 : transcript2}
                onChange={(e) =>
                  step === "answer-1"
                    ? setTranscript1(e.target.value)
                    : setTranscript2(e.target.value)
                }
                rows={6}
                maxLength={MAX_TRANSCRIPT_LENGTH}
                placeholder="Your recorded words appear here. Edit as needed before continuing."
                style={{ marginTop: 6 }}
              />
            </div>

            <Button
              onClick={step === "answer-1" ? getFollowUp : getFeedback}
              disabled={
                (step === "answer-1" ? !transcript1.trim() : !transcript2.trim())
              }
            >
              {step === "answer-1" ? "Get the follow-up question" : "Get feedback"}
            </Button>

            {demoLimited && <Callout tone="caution">{DEMO_LIMIT_MESSAGE}</Callout>}
            {error && !demoLimited && <Callout tone="critical">{error}</Callout>}
          </Card>
        </>
      )}

      {step === "done" && feedback && (
        <>
          <Card padding="lg">
            <h2 className="mb-5 text-h4 text-text-primary">Coaching notes</h2>
            <QAFeedbackSections feedback={feedback} />
          </Card>
          <Button variant="secondary" onClick={startOver}>
            Start over
          </Button>
        </>
      )}
    </div>
  );
}
