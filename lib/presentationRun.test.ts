import { describe, expect, it } from "vitest";
import { applyRecording, keepaliveSafe, shouldAcceptRecording, withTranscript } from "./presentationRun";
import type { AudioSummary } from "./types";

const audio: AudioSummary = { samples: 100, avgLevelPct: 50, comfortablePct: 70, steadinessPct: 60, tooSoftPct: 10, tooLoudPct: 5 };
const rec = (transcript: string) => ({
  transcript,
  durationSec: 60,
  nonverbal: null,
  audio,
  slideTimings: [{ slideId: "a", seconds: 60 }],
});

describe("shouldAcceptRecording", () => {
  it("only accepts a finished recording while the run screen is active", () => {
    expect(shouldAcceptRecording("run")).toBe(true);
    for (const s of ["setup", "feedback-loading", "feedback", "loading"]) {
      expect(shouldAcceptRecording(s)).toBe(false);
    }
  });
});

describe("applyRecording", () => {
  it("scores a recording with its transcript", () => {
    const r = applyRecording(null, rec("So today we cover churn and pricing and the ask."));
    expect(r.transcript).toMatch(/churn/);
    expect(r.durationSec).toBe(60);
    expect(r.effective).not.toBeNull();
    expect(r.signals?.pace).not.toBeNull();
    expect(r.slideTimings).toEqual([{ slideId: "a", seconds: 60 }]);
  });

  it("keeps a typed transcript when the recording captured no speech (no speech-to-text)", () => {
    const typed = withTranscript(null, "Churn is down twelve percent this quarter.");
    const r = applyRecording(typed, rec(""));
    expect(r.transcript).toBe("Churn is down twelve percent this quarter.");
    expect(r.signals?.pace).not.toBeNull(); // scored from the kept text + recording length
  });
});

describe("withTranscript", () => {
  it("rescores from the stored recording when the transcript is edited", () => {
    const recorded = applyRecording(null, rec(""));
    expect(recorded.signals?.pace ?? null).toBeNull();
    const edited = withTranscript(recorded, "Churn is down twelve percent this quarter and pricing has three tiers.");
    expect(edited.signals?.pace).not.toBeNull();
    expect(edited.signals?.fluency).not.toBeNull();
    expect(edited.durationSec).toBe(60);
    expect(edited.slideTimings).toEqual([{ slideId: "a", seconds: 60 }]);
  });

  it("has no score for typed text with no recording", () => {
    const typed = withTranscript(null, "Just typing notes");
    expect(typed.effective).toBeNull();
    expect(typed.durationSec).toBe(0);
  });
});

describe("keepaliveSafe", () => {
  it("allows small bodies and rejects bodies over ~60KB in UTF-8 bytes", () => {
    expect(keepaliveSafe("x".repeat(1000))).toBe(true);
    expect(keepaliveSafe("x".repeat(61_000))).toBe(false);
    // 25,000 curly quotes = 75,000 bytes in UTF-8 though only 25,000 chars
    expect(keepaliveSafe("’".repeat(25_000))).toBe(false);
  });
});
