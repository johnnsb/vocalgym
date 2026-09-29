import { describe, expect, it } from "vitest";
import { recordAnswer, shouldPersist } from "./interviewRound";
import type { InterviewExchange } from "./types";

const planned = { panelistId: "a", question: "Q2?" };
const prior: InterviewExchange[] = [
  { panelistId: "a", question: "Q1?", transcript: "A1", followUp: "F1?" },
];

describe("recordAnswer", () => {
  it("appends a new exchange for an answer to a planned question", () => {
    expect(recordAnswer(prior, false, planned, "  A2  ")).toEqual([
      prior[0],
      { panelistId: "a", question: "Q2?", transcript: "A2" },
    ]);
  });

  it("attaches an answer to the pending follow-up on the last exchange", () => {
    expect(recordAnswer(prior, true, planned, "FA1")).toEqual([
      { ...prior[0], followUpTranscript: "FA1" },
    ]);
  });

  it("returns the exchanges unchanged for a blank answer (end early with nothing typed)", () => {
    expect(recordAnswer(prior, false, planned, "   ")).toBe(prior);
    expect(recordAnswer(prior, true, planned, "")).toBe(prior);
  });
});

describe("shouldPersist", () => {
  it("saves when the form differs from what's on the server", () => {
    expect(shouldPersist({ loadFailed: false, snapshot: "b", lastSaved: "a" })).toBe(true);
  });
  it("skips when nothing changed", () => {
    expect(shouldPersist({ loadFailed: false, snapshot: "a", lastSaved: "a" })).toBe(false);
  });
  it("never saves after a failed load, so a blank form can't overwrite the real saved panel", () => {
    expect(shouldPersist({ loadFailed: true, snapshot: "b", lastSaved: "a" })).toBe(false);
  });
});
