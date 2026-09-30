import { describe, expect, it } from "vitest";
import { buildPresentationFeedbackPrompt } from "./prompt";
import { emptyPresentationPrep } from "./presentationPrep";
import type { PresentationPrep } from "./types";

const slidesPrep: PresentationPrep = {
  ...emptyPresentationPrep(),
  title: "Q3 review",
  mode: "slides",
  notes: "IGNORED NOTES",
  slides: [
    { id: "a", title: "Intro", notes: "Hook with the churn number" },
    { id: "b", title: "Pricing", notes: "" },
  ],
  audience: "Exec team; CFO cares about cost",
  timeLimitMin: 10,
};

const base = { transcript: "So today...", durationSec: 305, nonverbal: null, effective: null, signals: null };

describe("buildPresentationFeedbackPrompt", () => {
  it("tags slides S1..Sn with titles and notes, and marks empty notes", () => {
    const t = buildPresentationFeedbackPrompt({ ...base, prep: slidesPrep, slideTimings: [] });
    expect(t).toContain('<talk title="Q3 review">');
    expect(t).toContain('<slide tag="S1">\nTitle: Intro\n<notes>\nHook with the churn number\n</notes>\n</slide>');
    expect(t).toContain('<slide tag="S2">\nTitle: Pricing\n(no notes)\n</slide>');
    expect(t).not.toContain("IGNORED NOTES");
  });

  it("uses the notes block in notes mode", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: { ...slidesPrep, mode: "notes", notes: "Point one\nPoint two" },
      slideTimings: [],
    });
    expect(t).toContain("<notes>\nPoint one\nPoint two\n</notes>");
    expect(t).not.toContain("<slide ");
  });

  it("includes audience, time limit, timings and total duration", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: slidesPrep,
      slideTimings: [{ slideId: "b", seconds: 160 }, { slideId: "a", seconds: 45 }],
    });
    expect(t).toContain("<audience>\nExec team; CFO cares about cost\n</audience>");
    expect(t).toContain('<time_limit minutes="10" />');
    expect(t).toContain("S1 Intro: 0:45");
    expect(t).toContain("S2 Pricing: 2:40");
    expect(t).toContain("Total: 5:05");
    expect(t.indexOf("S1 Intro: 0:45")).toBeLessThan(t.indexOf("S2 Pricing: 2:40"));
  });

  it("omits optional blocks when absent", () => {
    const t = buildPresentationFeedbackPrompt({
      ...base,
      prep: { ...slidesPrep, audience: "", timeLimitMin: null },
      slideTimings: [],
    });
    expect(t).not.toContain("<audience>");
    expect(t).not.toContain("<time_limit");
    expect(t).not.toContain("<slide_timings>");
    expect(t).not.toContain("<camera>");
    expect(t).not.toContain("EFFECTIVENESS RUBRIC");
    expect(t).toContain("Total: 5:05");
  });

  it("labels the transcript as speech-to-text", () => {
    const t = buildPresentationFeedbackPrompt({ ...base, prep: slidesPrep, slideTimings: [] });
    expect(t).toMatch(/<transcript>\n\(Spoken out loud and transcribed by speech-to-text[^\n]*\)\nSo today\.\.\.\n<\/transcript>/);
  });
});
