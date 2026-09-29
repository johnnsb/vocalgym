import { describe, expect, it } from "vitest";
import {
  buildInterviewContext,
  buildInterviewFeedbackPrompt,
  buildInterviewFollowUpPrompt,
  panelTag,
} from "./prompt";
import { emptyPanelist, emptyPrep } from "./interviewPrep";
import type { InterviewPrepState } from "./types";

function prep(): InterviewPrepState {
  return {
    panel: [
      { ...emptyPanelist("a"), name: "Priya", title: "VP Eng", about: "Ex-Stripe, cares about scale" },
      emptyPanelist("b"),
    ],
    candidate: { jobDescription: "Staff engineer", background: "", keyPoints: ["Led migration"] },
  };
}

describe("buildInterviewContext", () => {
  it("tags interviewers P1..Pn in panel order", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).toContain('<interviewer tag="P1">');
    expect(ctx).toContain('<interviewer tag="P2">');
    expect(ctx.indexOf('tag="P1"')).toBeLessThan(ctx.indexOf("Priya"));
  });

  it("still emits a tag for an interviewer with no details", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).toMatch(/<interviewer tag="P2">\n\(no details given\)\n<\/interviewer>/);
  });

  it("omits empty fields and empty candidate sections", () => {
    const ctx = buildInterviewContext(prep());
    expect(ctx).not.toContain("Company:");
    expect(ctx).not.toContain("<candidate_background>");
    expect(ctx).toContain("<job_description>\nStaff engineer\n</job_description>");
    expect(ctx).toContain("<key_points_to_land>\n- Led migration\n</key_points_to_land>");
    expect(buildInterviewContext(emptyPrep())).not.toContain("<job_description>");
  });
});

describe("panelTag", () => {
  it("maps ids to P<n> and unknown ids to P?", () => {
    const p = prep().panel;
    expect(panelTag(p, "a")).toBe("P1");
    expect(panelTag(p, "b")).toBe("P2");
    expect(panelTag(p, "zzz")).toBe("P?");
  });
});

describe("buildInterviewFollowUpPrompt", () => {
  it("names the asking interviewer's tag and includes the answer and upcoming questions", () => {
    const text = buildInterviewFollowUpPrompt(prep(), "b", "Why leave?", "Growth, mostly.", ["What's your stack?"]);
    expect(text).toContain('<asked_by tag="P2" />');
    expect(text).toContain("<question>\nWhy leave?\n</question>");
    expect(text).toContain("Growth, mostly.");
    expect(text).toContain("- What's your stack?");
  });
  it("omits the upcoming block when there are none", () => {
    expect(buildInterviewFollowUpPrompt(prep(), "a", "Q?", "A", [])).not.toContain("<upcoming_questions>");
  });
});

describe("buildInterviewFeedbackPrompt", () => {
  it("numbers exchanges, tags the asker, and includes answered follow-ups", () => {
    const text = buildInterviewFeedbackPrompt(prep(), [
      { panelistId: "a", question: "Q1?", transcript: "A1", followUp: "F1?", followUpTranscript: "FA1" },
      { panelistId: "b", question: "Q2?", transcript: "A2" },
    ]);
    expect(text).toContain('<exchange number="1" asked_by="P1">');
    expect(text).toContain('<exchange number="2" asked_by="P2">');
    expect(text).toContain("<follow_up>\nF1?\n</follow_up>");
    expect(text).toContain("FA1");
  });
  it("never includes a follow-up that has no answer", () => {
    const text = buildInterviewFeedbackPrompt(prep(), [
      { panelistId: "a", question: "Q1?", transcript: "A1", followUp: "F1?" },
    ]);
    expect(text).not.toContain("F1?");
    expect(text).not.toContain("<follow_up>");
  });
});
