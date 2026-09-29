import { describe, expect, it } from "vitest";
import { parseInterviewPlan } from "./anthropic";
import { emptyPanelist } from "./interviewPrep";

const panel = [emptyPanelist("a"), emptyPanelist("b")];

describe("parseInterviewPlan", () => {
  it("maps P<n> tags to panelist ids", () => {
    const out = parseInterviewPlan("P1: Why this role?\nP2: Tell me about a hard bug?", panel);
    expect(out).toEqual([
      { panelistId: "a", question: "Why this role?" },
      { panelistId: "b", question: "Tell me about a hard bug?" },
    ]);
  });

  it("tolerates bullets, numbering, bold and dash separators", () => {
    const text = [
      "Here is the plan:",
      "- **P1:** What drew you here?",
      "2. P2 — How do you handle on-call?",
      "3) **P1** - What would you do first?",
      "",
    ].join("\n");
    expect(parseInterviewPlan(text, panel).map((q) => q.panelistId)).toEqual(["a", "b", "a"]);
    expect(parseInterviewPlan(text, panel)[0].question).toBe("What drew you here?");
  });

  it("keeps out-of-range tags with an empty panelistId so verification fails", () => {
    expect(parseInterviewPlan("P3: Who are you?", panel)).toEqual([
      { panelistId: "", question: "Who are you?" },
    ]);
  });

  it("ignores lines without a tag", () => {
    expect(parseInterviewPlan("Sure! Here you go.\nThanks.", panel)).toEqual([]);
  });
});
