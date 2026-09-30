import { PRESENTATION_RUBRIC, computeEffective, computeSignals } from "./rubric";
import type {
  AudioSummary,
  EffectiveResult,
  NonverbalMetrics,
  ObservableSignals,
  SlideTiming,
} from "./types";

// Pure run-through state for presentation mode (components/PresentationRun +
// PresentationSession). The recording's raw inputs (audio, camera, duration)
// are kept so the score can be recomputed whenever the transcript changes —
// a typed or corrected transcript must not leave a stale score behind.

export interface RunResult {
  transcript: string;
  durationSec: number;
  audio: AudioSummary | null;
  nonverbal: NonverbalMetrics | null;
  signals: ObservableSignals | null;
  effective: EffectiveResult | null;
  slideTimings: SlideTiming[] | null;
}

export interface Recording {
  transcript: string;
  durationSec: number;
  nonverbal: NonverbalMetrics | null;
  audio: AudioSummary | null;
  slideTimings: SlideTiming[] | null;
}

/** A recording that finishes after the run screen is gone (the user clicked
 *  "Get feedback" or "Edit setup" mid-take) must not overwrite the result. */
export function shouldAcceptRecording(stage: string): boolean {
  return stage === "run";
}

function score(r: Omit<RunResult, "signals" | "effective">): RunResult {
  if (r.durationSec <= 0) return { ...r, signals: null, effective: null };
  const signals = computeSignals({
    nonverbal: r.nonverbal,
    audio: r.audio,
    transcript: r.transcript,
    durationSec: r.durationSec,
  });
  return { ...r, signals, effective: computeEffective(PRESENTATION_RUBRIC, signals) };
}

/** A new take replaces the previous one — except its transcript, when the
 *  recording captured no speech (browsers without speech-to-text), so text
 *  the user typed isn't wiped. */
export function applyRecording(prev: RunResult | null, rec: Recording): RunResult {
  const transcript = rec.transcript.trim() ? rec.transcript : prev?.transcript ?? "";
  return score({
    transcript,
    durationSec: Math.round(rec.durationSec),
    audio: rec.audio,
    nonverbal: rec.nonverbal,
    slideTimings: rec.slideTimings,
  });
}

/** Transcript edited (or typed with no recording): keep the take, rescore. */
export function withTranscript(prev: RunResult | null, transcript: string): RunResult {
  return score({
    transcript,
    durationSec: prev?.durationSec ?? 0,
    audio: prev?.audio ?? null,
    nonverbal: prev?.nonverbal ?? null,
    slideTimings: prev?.slideTimings ?? null,
  });
}

/** Browsers cap keepalive request bodies at 64KB; stay under with margin,
 *  measured in UTF-8 bytes (curly quotes, CJK and emoji are multi-byte). */
export function keepaliveSafe(body: string): boolean {
  return new TextEncoder().encode(body).length <= 60_000;
}
