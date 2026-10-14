"use client";

import { useState } from "react";
import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import { PRESENTATION_LIMITS } from "@/lib/presentationPrep";
import { Badge, Button, Card, Textarea } from "@/components/ui";

interface Props {
  question: string;
  /** 1-based */
  number: number;
  total: number;
  answer: string;
  onAnswer: (text: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

// One audience question after the talk: record (or type) an answer, then
// continue. A recording that captured no speech keeps any typed text.
export default function PresentationQaStep({
  question,
  number,
  total,
  answer,
  onAnswer,
  onContinue,
  onSkip,
}: Props) {
  const speechSupported = speechRecognitionSupported();
  const [recording, setRecording] = useState(false);
  const last = number === total;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-text-muted" aria-live="polite">
          Audience question {number} of {total}
        </span>
        <Badge tone="accent">Q&amp;A</Badge>
      </div>
      <p className="font-serif text-h3 text-text-primary">{question}</p>

      <PracticeRecorder
        key={number}
        script={question}
        contentLabel="Audience question"
        onRecordingChange={setRecording}
        onComplete={({ transcript }) => {
          if (transcript.trim()) onAnswer(transcript);
        }}
      />

      <div>
        <label htmlFor="qa-answer" className="block text-body-sm font-medium text-text-primary">
          Your answer
          {!speechSupported && (
            <span className="ml-2 font-normal text-text-muted">
              (speech-to-text unavailable in this browser — type it here)
            </span>
          )}
        </label>
        <Textarea
          id="qa-answer"
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          rows={4}
          maxLength={PRESENTATION_LIMITS.qaAnswer}
          placeholder="Your recorded answer appears here. Edit as needed."
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onContinue} disabled={recording || !answer.trim()} iconAfter="arrow-right">
          {last ? "Get feedback" : "Next question"}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={recording}>
          {last ? "Skip this one → get feedback" : "Skip the rest → get feedback"}
        </Button>
      </div>
    </Card>
  );
}
