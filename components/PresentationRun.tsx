"use client";

import { useRef, useState } from "react";
import PracticeRecorder, { speechRecognitionSupported } from "./PracticeRecorder";
import EffectiveScore from "./EffectiveScore";
import { PRESENTATION_LIMITS, accumulateTimings } from "@/lib/presentationPrep";
import type { Recording, RunResult } from "@/lib/presentationRun";
import type { PresentationPrep } from "@/lib/types";
import { Button, Card, Textarea } from "@/components/ui";

interface Props {
  prep: PresentationPrep;
  result: RunResult | null;
  /** A finished recording (scored by the parent via applyRecording). */
  onRecording: (r: Recording) => void;
  onTranscript: (t: string) => void;
  onGetFeedback: () => void;
  onBack: () => void;
  /** Label for the main button (default "Get feedback"). */
  primaryLabel?: string;
  /** Optional extra action next to it (e.g. skip audience questions). */
  secondary?: { label: string; onClick: () => void };
}

// One continuous take. Slides mode shows the current slide with prev/next;
// every slide change is timestamped, and when a recording stops the time on
// each slide inside the recording window is computed (accumulateTimings).
// Recording again replaces the previous take.
export default function PresentationRun({
  prep,
  result,
  onRecording,
  onTranscript,
  onGetFeedback,
  onBack,
  primaryLabel = "Get feedback",
  secondary,
}: Props) {
  const slides = prep.mode === "slides" ? prep.slides : [];
  const [index, setIndex] = useState(0);
  const changes = useRef<{ slideId: string; at: number }[]>(
    slides.length ? [{ slideId: slides[0].id, at: Date.now() }] : [],
  );
  const speechSupported = speechRecognitionSupported();
  // While recording, leaving the run screen would let the take land after
  // the fact — so Get feedback / Edit setup wait until it stops.
  const [recording, setRecording] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);

  function go(to: number) {
    const next = Math.min(Math.max(to, 0), slides.length - 1);
    if (next === index) return;
    setIndex(next);
    changes.current.push({ slideId: slides[next].id, at: Date.now() });
    // Reaching either end disables the button that has focus; hand focus to
    // the other one so keyboard users aren't dropped back to the page.
    const nav = navRef.current;
    if (nav && nav.contains(document.activeElement) && (next === 0 || next === slides.length - 1)) {
      requestAnimationFrame(() => {
        const [prevBtn, nextBtn] = Array.from(nav.querySelectorAll("button"));
        (next === 0 ? nextBtn : prevBtn)?.focus();
      });
    }
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
            <span className="text-caption text-text-muted" aria-live="polite">
              Slide {index + 1} of {slides.length}
            </span>
            <div className="flex gap-2" ref={navRef}>
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
          onRecordingChange={setRecording}
          onComplete={({ transcript, durationSec, nonverbal, audio }) => {
            const stopAt = Date.now();
            const startAt = stopAt - durationSec * 1000;
            onRecording({
              transcript,
              durationSec,
              nonverbal,
              audio,
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
          <Button onClick={onGetFeedback} disabled={recording || !result?.transcript.trim()} iconAfter="arrow-right">
            {primaryLabel}
          </Button>
          {secondary && (
            <Button variant="secondary" onClick={secondary.onClick} disabled={recording || !result?.transcript.trim()}>
              {secondary.label}
            </Button>
          )}
          <Button variant="ghost" onClick={onBack} disabled={recording}>
            Edit setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
