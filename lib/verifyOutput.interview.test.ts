import { describe, expect, it } from "vitest";
import { verifyInterviewFeedback, verifyInterviewPlan } from "./verifyOutput";
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

const FULL = [
  "**Overall** — Solid.",
  "**Question by question**",
  "### Why this role?",
  "- Good hook.",
  "**Key points** — You landed the migration.",
  "**Reading the panel** — Priya wanted numbers.",
  "**For your next round**",
  "- Lead with the result.",
].join("\n");

describe("verifyInterviewFeedback", () => {
  it("accepts all sections", () => {
    expect(verifyInterviewFeedback(FULL, true).ok).toBe(true);
  });
  it("requires Key points only when key points were given", () => {
    const noKp = FULL.replace("**Key points** — You landed the migration.\n", "");
    expect(verifyInterviewFeedback(noKp, false).ok).toBe(true);
    expect(verifyInterviewFeedback(noKp, true)).toMatchObject({ ok: false, missing: ["Key points"] });
  });
  it("reports missing required sections", () => {
    const r = verifyInterviewFeedback(FULL.replace("**Reading the panel** — Priya wanted numbers.", ""), false);
    expect(r).toMatchObject({ ok: false, missing: ["Reading the panel"] });
  });
  it("rejects empty or tiny output", () => {
    expect(verifyInterviewFeedback("", false)).toMatchObject({ ok: false, reason: "empty-or-too-short" });
    expect(verifyInterviewFeedback(null, false).ok).toBe(false);
  });
});

describe("verifyInterviewFeedback section headings", () => {
  it("does not let a ### question subheading stand in for a missing section", () => {
    const text = [
      "**Overall** — Solid.",
      "**Question by question**",
      "### Next round of funding — how would you prioritize?",
      "- Good hook.",
      "**Reading the panel** — Priya wanted numbers.",
    ].join("\n");
    expect(verifyInterviewFeedback(text, false)).toMatchObject({ ok: false, missing: ["For your next round"] });
  });
  it("still accepts ## section headings", () => {
    const text = ["## Overall", "Solid.", "## Question by question", "- x", "## Reading the panel", "- y", "## For your next round", "- z"].join("\n");
    expect(verifyInterviewFeedback(text, false).ok).toBe(true);
  });
});
