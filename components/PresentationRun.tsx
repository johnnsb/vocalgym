"use client";

import { useRef, useState } from "react";
import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import EffectiveScore from "./EffectiveScore";
import { PRESENTATION_LIMITS, accumulateTimings } from "@/lib/presentationPrep";
import { PRESENTATION_RUBRIC, computeEffective, computeSignals } from "@/lib/rubric";
import type {
  EffectiveResult,
  NonverbalMetrics,
  ObservableSignals,
  PresentationPrep,
  SlideTiming,
} from "@/lib/types";
import { Button, Card, Textarea } from "@/components/ui";

export interface RunResult {
  transcript: string;
  durationSec: number;
  nonverbal: NonverbalMetrics | null;
  signals: ObservableSignals | null;
  effective: EffectiveResult | null;
  slideTimings: SlideTiming[] | null;
}

interface Props {
  prep: PresentationPrep;
  result: RunResult | null;
  onResult: (r: RunResult) => void;
  onTranscript: (t: string) => void;
  onGetFeedback: () => void;
  onBack: () => void;
}

// One continuous take. Slides mode shows the current slide with prev/next;
// every slide change is timestamped, and when a recording stops the time on
// each slide inside the recording window is computed (accumulateTimings).
// Recording again replaces the previous take.
export default function PresentationRun({ prep, result, onResult, onTranscript, onGetFeedback, onBack }: Props) {
  const slides = prep.mode === "slides" ? prep.slides : [];
  const [index, setIndex] = useState(0);
  const changes = useRef<{ slideId: string; at: number }[]>(
    slides.length ? [{ slideId: slides[0].id, at: Date.now() }] : [],
  );
  const speechSupported = speechRecognitionSupported();

  function go(to: number) {
    const next = Math.min(Math.max(to, 0), slides.length - 1);
    if (next === index) return;
    setIndex(next);
    changes.current.push({ slideId: slides[next].id, at: Date.now() });
  }

  const current = slides[index];
  const reference =
    prep.mode === "slides" && current
      ? `${current.title || "(untitled)"}\n\n${current.notes || "(no notes)"}`
      : prep.notes;

  return (
    <div className="space-y-4">
      {prep.mode === "slides" && current && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-text-muted">
              Slide {index + 1} of {slides.length}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => go(index - 1)} disabled={index === 0}>
                Prev
              </Button>
              <Button variant="secondary" size="sm" iconAfter="arrow-right" onClick={() => go(index + 1)} disabled={index === slides.length - 1}>
                Next
              </Button>
            </div>
          </div>
          <p className="font-serif text-h3 text-text-primary">{current.title || "(untitled)"}</p>
          <p className="whitespace-pre-wrap text-body-sm text-text-body">{current.notes || "(no notes)"}</p>
        </Card>
      )}

      <Card className="space-y-4">
        <PracticeRecorder
          script={reference}
          contentLabel={prep.mode === "slides" ? "Current slide" : "Your notes"}
          onComplete={({ transcript, durationSec, nonverbal, audio }) => {
            const stopAt = Date.now();
            const startAt = stopAt - durationSec * 1000;
            const sig = computeSignals({ nonverbal, audio, transcript, durationSec });
            onResult({
              transcript,
              durationSec: Math.round(durationSec),
              nonverbal,
              signals: sig,
              effective: computeEffective(PRESENTATION_RUBRIC, sig),
              slideTimings: slides.length ? accumulateTimings(changes.current, startAt, stopAt) : null,
            });
          }}
        />

        <div>
          <label htmlFor="run-transcript" className="block text-body-sm font-medium text-text-primary">
            What you said
            {!speechSupported && (
              <span className="ml-2 font-normal text-text-muted">
                (speech-to-text unavailable in this browser — type it here)
              </span>
            )}
          </label>
          <Textarea
            id="run-transcript"
            value={result?.transcript ?? ""}
            onChange={(e) => onTranscript(e.target.value)}
            rows={6}
            maxLength={PRESENTATION_LIMITS.transcript}
            placeholder="Your recorded words appear here. Edit as needed before getting feedback."
            style={{ marginTop: 6 }}
          />
        </div>

        {result?.effective && <EffectiveScore result={result.effective} signals={result.signals} compact />}

        <div className="flex flex-wrap gap-3">
          <Button onClick={onGetFeedback} disabled={!result?.transcript.trim()} iconAfter="arrow-right">
            Get feedback
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Edit setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
