"use client";

import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import { PREP_LIMITS } from "@/lib/interviewPrep";
import { Badge, Button, Card, Textarea } from "@/components/ui";

interface Props {
  askedBy: string;
  question: string;
  isFollowUp: boolean;
  /** 1-based planned-question number and total. */
  number: number;
  total: number;
  transcript: string;
  onTranscript: (t: string) => void;
  onSubmit: () => void;
  canEndEarly: boolean;
  onEndEarly: () => void;
}

export default function InterviewRound({
  askedBy,
  question,
  isFollowUp,
  number,
  total,
  transcript,
  onTranscript,
  onSubmit,
  canEndEarly,
  onEndEarly,
}: Props) {
  const speechSupported = speechRecognitionSupported();

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-text-muted">
          Question {number} of {total}
        </span>
        {isFollowUp && <Badge tone="accent">Follow-up</Badge>}
      </div>
      <div>
        <p className="text-body-sm text-text-muted">{askedBy} asks:</p>
        <p className="mt-1 font-serif text-h3 text-text-primary">{question}</p>
      </div>

      <PracticeRecorder
        key={`${number}-${isFollowUp ? "f" : "q"}`}
        script={question}
        contentLabel={isFollowUp ? "Follow-up question" : "Question"}
        onComplete={({ transcript: t }) => onTranscript(t)}
      />

      <div>
        <label
          htmlFor="interview-transcript"
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
          id="interview-transcript"
          value={transcript}
          onChange={(e) => onTranscript(e.target.value)}
          rows={6}
          maxLength={PREP_LIMITS.transcript}
          placeholder="Your recorded words appear here. Edit as needed before continuing."
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit} disabled={!transcript.trim()} iconAfter="arrow-right">
          Continue
        </Button>
        {canEndEarly && (
          <Button variant="ghost" onClick={onEndEarly}>
            End early → get feedback
          </Button>
        )}
      </div>
    </Card>
  );
}
