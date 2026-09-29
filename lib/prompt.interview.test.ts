import { describe, expect, it } from "vitest";
import { buildInterviewContext, panelTag } from "./prompt";
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
