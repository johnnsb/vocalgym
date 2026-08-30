export const TONES = [
  "professional",
  "personal",
  "high-stakes",
  "supportive",
  "persuasive",
  "celebratory",
] as const;

export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  personal: "Personal",
  "high-stakes": "High-stakes",
  supportive: "Supportive",
  persuasive: "Persuasive",
  celebratory: "Celebratory",
};

export interface GenerateScriptRequest {
  situation: string;
  /** Empty string means "no preference". */
  tone?: Tone | "";
}

export interface GenerateScriptResponse {
  script: string;
  /** 2–4 word title for the script, generated in the same call. May be "". */
  label: string;
}

export interface ScriptLabelResponse {
  /** 2–4 word title, or "" if generation failed (non-fatal). */
  label: string;
}

export interface ErrorResponse {
  error: string;
}

export interface NonverbalSpan {
  startSec: number;
  endSec: number;
}

/**
 * Rough nonverbal signals estimated in the browser from the user's webcam
 * (MediaPipe Face + Pose Landmarker). Optional — only present when the user
 * turned the camera on for a take. Frames never leave the device; only this
 * summary is sent to the feedback API.
 */
export interface NonverbalMetrics {
  durationSec: number;
  samples: number;
  faceDetectedPct: number;
  poseDetectedPct: number;
  eyeContact: {
    facingForwardPct: number;
    longestAwaySec: number;
    awaySpans: NonverbalSpan[];
  };
  posture: {
    uprightPct: number;
    headTilt: "level" | "tilted left" | "tilted right";
    shoulderLevelPct: number | null;
    leanForwardSpans: NonverbalSpan[];
    swayNote: string | null;
    /** 0–100, higher = less swaying / fidgeting. */
    stillnessScore: number;
  };
  expressiveness: {
    smileCount: number;
    smilePresentPct: number;
    avgSmileIntensity: number;
    browTensionPct: number;
    browTensionSpans: NonverbalSpan[];
  };
}

/**
 * Rough audio-level readout from the mic during a take (Web Audio RMS). Device
 * gain varies, so these are relative, not calibrated dB.
 */
export interface AudioSummary {
  samples: number;
  avgLevelPct: number;
  comfortablePct: number;
  steadinessPct: number;
  tooSoftPct: number;
  tooLoudPct: number;
}

/**
 * Aspirational qualities the user can choose to be scored on. Each maps, in
 * lib/rubric.ts, to a weighted blend of the observable signals below.
 */
export const RUBRIC_ATTRIBUTES = [
  "connected",
  "present",
  "smooth",
  "composed",
  "warm",
  "confident",
  "grounded",
  "clear",
] as const;
export type RubricAttribute = (typeof RUBRIC_ATTRIBUTES)[number];

/** The user's pick + stack rank (order) + weight (percent) per attribute. */
export interface RubricSelection {
  attributes: RubricAttribute[];
  weights: Record<string, number>;
  /**
   * true once the user hand-edits the picker. While false/absent the rubric
   * tracks the tone/context preset and updates when the tone changes.
   */
  custom?: boolean;
}

/** 0–100 per signal, or null when this take couldn't measure it. */
export interface ObservableSignals {
  eyeContact: number | null;
  posture: number | null;
  stillness: number | null;
  expressiveness: number | null;
  composure: number | null;
  volume: number | null;
  steadiness: number | null;
  fluency: number | null;
  pace: number | null;
}

export interface EffectiveBreakdownRow {
  attribute: RubricAttribute;
  label: string;
  weight: number;
  score: number | null;
  usedSignals: string[];
  missingSignals: string[];
}

export interface EffectiveResult {
  score: number;
  label: string;
  rows: EffectiveBreakdownRow[];
  /** fraction of chosen attributes that had at least one measurable signal */
  coverage: number;
}

export interface PracticeFeedbackRequest {
  script: string;
  transcript: string;
  situation?: string;
  tone?: Tone | "";
  nonverbal?: NonverbalMetrics | null;
  rubric?: RubricSelection | null;
  signals?: ObservableSignals | null;
  effective?: EffectiveResult | null;
}

export interface PracticeFeedbackResponse {
  feedback: string;
}

/**
 * The script the user most recently generated, stashed in localStorage so the
 * /practice route can pick it up. Only the latest is kept.
 */
export interface StoredScript {
  script: string;
  situation: string;
  tone: Tone | "";
  savedAt: number;
  /** How this script got here — "uploaded" hides the Regenerate action. */
  source?: "generated" | "uploaded";
  /** Stable id for this script, assigned server-side and keyed to the text.
   *  Attempts reference it so the history can be grouped. */
  id?: string;
  /** 2–4 word Claude-generated title, used as the group header in history. */
  label?: string;
}

/** One rehearsal attempt plus the coaching it got back. Persisted in localStorage. */
export interface PracticeAttempt {
  id: string;
  createdAt: number;
  script: string;
  situation: string;
  tone: Tone | "";
  transcript: string;
  feedback: string;
  nonverbal?: NonverbalMetrics | null;
  effective?: EffectiveResult | null;
  /** Which script this attempt belongs to, for grouping the history. */
  scriptId?: string | null;
  /** The script's label at the time of the attempt (denormalized). */
  scriptLabel?: string | null;
}
