export const TONES = [
  "professional",
  "personal",
  "high-stakes",
  "supportive",
  "persuasive",
  "celebratory",
] as const;

export type Tone = (typeof TONES)[number];

export interface GenerateScriptRequest {
  situation: string;
  /** Empty string means "no preference". */
  tone?: Tone | "";
}

export interface GenerateScriptResponse {
  script: string;
}

export interface ErrorResponse {
  error: string;
}

export interface PracticeFeedbackRequest {
  script: string;
  transcript: string;
  situation?: string;
  tone?: Tone | "";
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
}
