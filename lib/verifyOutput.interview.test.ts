import { describe, expect, it } from "vitest";
import { verifyInterviewPlan } from "./verifyOutput";
import { emptyPanelist } from "./interviewPrep";

const panel = [emptyPanelist("a"), emptyPanelist("b")];
const q = (panelistId: string, question = "What drew you to this role?") => ({ panelistId, question });

describe("verifyInterviewPlan", () => {
  it("accepts 3-6 complete questions from known panelists", () => {
    expect(verifyInterviewPlan([q("a"), q("b"), q("a"), q("b")], panel).ok).toBe(true);
  });
  it("rejects too few or too many", () => {
    expect(verifyInterviewPlan([q("a"), q("b")], panel)).toMatchObject({ ok: false, reason: "too-few" });
    expect(verifyInterviewPlan(Array(7).fill(q("a")), panel)).toMatchObject({ ok: false, reason: "too-many" });
    expect(verifyInterviewPlan("nope", panel)).toMatchObject({ ok: false });
  });
  it("rejects an unknown panelist", () => {
    expect(verifyInterviewPlan([q("a"), q(""), q("b")], panel)).toMatchObject({ ok: false, reason: "unknown-panelist" });
  });
  it("rejects a question cut off mid-sentence", () => {
    expect(verifyInterviewPlan([q("a"), q("b"), q("a", "Tell me about the time you")], panel))
      .toMatchObject({ ok: false, reason: "item-not-a-question" });
  });
});
