import { describe, expect, it } from "vitest";
import {
  PREP_LIMITS,
  emptyPanelist,
  emptyPrep,
  hasPanelContent,
  normalizeExchanges,
  normalizePrep,
  panelistLabel,
} from "./interviewPrep";

describe("normalizePrep", () => {
  it("returns one blank panelist and an empty candidate for junk input", () => {
    for (const input of [null, undefined, 42, "x", {}, { panel: [] }]) {
      const s = normalizePrep(input);
      expect(s.panel).toHaveLength(1);
      expect(s.panel[0]).toMatchObject({ name: "", about: "" });
      expect(s.panel[0].id).toBeTruthy();
      expect(s.candidate).toEqual({ jobDescription: "", background: "", keyPoints: [] });
    }
  });

  it("caps the panel at 4", () => {
    const panel = Array.from({ length: 6 }, (_, i) => ({ id: `id${i}`, name: `N${i}` }));
    expect(normalizePrep({ panel }).panel).toHaveLength(PREP_LIMITS.panelMax);
  });

  it("truncates every field to its limit", () => {
    const long = "x".repeat(20_000);
    const s = normalizePrep({
      panel: [{ id: "a", name: long, title: long, company: long, about: long, pastQuestions: long }],
      candidate: { jobDescription: long, background: long, keyPoints: [long] },
    });
    const p = s.panel[0];
    expect(p.name).toHaveLength(120);
    expect(p.title).toHaveLength(120);
    expect(p.company).toHaveLength(120);
    expect(p.about).toHaveLength(8000);
    expect(p.pastQuestions).toHaveLength(2000);
    expect(s.candidate.jobDescription).toHaveLength(8000);
    expect(s.candidate.background).toHaveLength(8000);
    expect(s.candidate.keyPoints[0]).toHaveLength(200);
  });

  it("coerces non-strings to empty strings and drops unknown keys", () => {
    const s = normalizePrep({
      panel: [{ id: "a", name: 5, about: { x: 1 }, evil: "y" }],
      candidate: { jobDescription: [], extra: 1 },
    });
    expect(s.panel[0]).toEqual({
      id: "a", name: "", title: "", company: "", about: "", pastQuestions: "",
    });
    expect(Object.keys(s.candidate).sort()).toEqual(["background", "jobDescription", "keyPoints"]);
  });

  it("keeps at most 5 key points, trimmed, blanks dropped", () => {
    const s = normalizePrep({
      candidate: { keyPoints: ["  a  ", "", "   ", "b", 7, "c", "d", "e", "f"] },
    });
    expect(s.candidate.keyPoints).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("assigns ids to panelists missing one and de-duplicates ids", () => {
    const s = normalizePrep({ panel: [{ name: "A" }, { id: "dup" }, { id: "dup" }] });
    const ids = s.panel.map((p) => p.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(ids[1]).toBe("dup");
  });
});

describe("hasPanelContent", () => {
  it("is false for a blank panel and true once any panelist field has text", () => {
    expect(hasPanelContent(emptyPrep())).toBe(false);
    const s = emptyPrep();
    s.panel.push({ ...emptyPanelist("b"), company: "  Acme " });
    expect(hasPanelContent(s)).toBe(true);
    expect(hasPanelContent({ ...emptyPrep(), panel: [{ ...emptyPanelist("c"), about: "   " }] })).toBe(false);
  });
});

describe("panelistLabel", () => {
  it("uses name and title when present", () => {
    expect(panelistLabel({ ...emptyPanelist("a"), name: "Priya Shah", title: "VP Engineering" }, 0))
      .toBe("Priya Shah · VP Engineering");
  });
  it("falls back to 'Interviewer N' (1-based) when unnamed", () => {
    expect(panelistLabel(emptyPanelist("a"), 1)).toBe("Interviewer 2");
    expect(panelistLabel({ ...emptyPanelist("a"), title: "Recruiter" }, 2)).toBe("Interviewer 3 · Recruiter");
  });
});

describe("normalizeExchanges", () => {
  it("drops malformed entries and exchanges without an answer", () => {
    const ex = normalizeExchanges([
      null,
      { panelistId: "a", question: "Q1?", transcript: "answer" },
      { panelistId: "a", question: "Q2?", transcript: "   " },
      { panelistId: 3, question: "Q3?", transcript: "x" },
    ]);
    expect(ex).toEqual([{ panelistId: "a", question: "Q1?", transcript: "answer" }]);
  });

  it("keeps a follow-up only when it was actually answered", () => {
    const ex = normalizeExchanges([
      { panelistId: "a", question: "Q1?", transcript: "x", followUp: "F1?", followUpTranscript: "y" },
      { panelistId: "a", question: "Q2?", transcript: "x", followUp: "F2?", followUpTranscript: "" },
      { panelistId: "a", question: "Q3?", transcript: "x", followUp: "F3?" },
    ]);
    expect(ex[0]).toEqual({ panelistId: "a", question: "Q1?", transcript: "x", followUp: "F1?", followUpTranscript: "y" });
    expect(ex[1]).toEqual({ panelistId: "a", question: "Q2?", transcript: "x" });
    expect(ex[2]).toEqual({ panelistId: "a", question: "Q3?", transcript: "x" });
  });

  it("returns [] for non-arrays and caps at 10 exchanges", () => {
    expect(normalizeExchanges("nope")).toEqual([]);
    const many = Array.from({ length: 15 }, () => ({ panelistId: "a", question: "Q?", transcript: "x" }));
    expect(normalizeExchanges(many)).toHaveLength(10);
  });
});
