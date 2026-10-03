import { describe, expect, it } from "vitest";
import {
  PRESENTATION_LIMITS,
  accumulateTimings,
  capSlides,
  emptyPresentationPrep,
  formatDuration,
  parseTimeLimit,
  normalizePresentationPrep,
  normalizeSlideTimings,
  normalizeTakeInput,
  presentationHasContent,
} from "./presentationPrep";

const slide = (id: string, title = "", notes = "") => ({ id, title, notes });

describe("normalizePresentationPrep", () => {
  it("returns defaults for junk input", () => {
    for (const input of [null, undefined, 1, "x", [], {}]) {
      expect(normalizePresentationPrep(input)).toEqual(emptyPresentationPrep());
    }
    expect(emptyPresentationPrep()).toEqual({
      title: "", mode: "notes", notes: "", slides: [], audience: "", timeLimitMin: null,
    });
  });

  it("truncates text fields to their limits", () => {
    const long = "x".repeat(30_000);
    const p = normalizePresentationPrep({
      title: long, notes: long, audience: long,
      slides: [{ id: "a", title: long, notes: long }],
    });
    expect(p.title).toHaveLength(120);
    expect(p.notes).toHaveLength(12_000);
    expect(p.audience).toHaveLength(2_000);
    expect(p.slides[0].title).toHaveLength(200);
    expect(p.slides[0].notes).toHaveLength(2_000);
  });

  it("accepts only the two modes", () => {
    expect(normalizePresentationPrep({ mode: "slides" }).mode).toBe("slides");
    expect(normalizePresentationPrep({ mode: "video" }).mode).toBe("notes");
  });

  it("keeps time limits of 1-120 whole minutes, else null", () => {
    expect(normalizePresentationPrep({ timeLimitMin: 10 }).timeLimitMin).toBe(10);
    expect(normalizePresentationPrep({ timeLimitMin: 7.6 }).timeLimitMin).toBe(8);
    for (const bad of [0, -3, 121, "10", NaN, null]) {
      expect(normalizePresentationPrep({ timeLimitMin: bad }).timeLimitMin).toBeNull();
    }
  });

  it("gives every slide a unique id", () => {
    const p = normalizePresentationPrep({ slides: [{ title: "A" }, { id: "x" }, { id: "x" }, { id: "x-3" }] });
    const ids = p.slides.map((s) => s.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("capSlides", () => {
  it("keeps at most 40 slides", () => {
    const many = Array.from({ length: 60 }, (_, i) => slide(`s${i}`, `T${i}`));
    const r = capSlides(many);
    expect(r.slides).toHaveLength(PRESENTATION_LIMITS.slidesMax);
    expect(r.truncated).toBe(true);
  });

  it("caps combined notes at 20,000 chars, cutting later slides first", () => {
    const deck = Array.from({ length: 12 }, (_, i) => slide(`s${i}`, `T${i}`, "n".repeat(2_000)));
    const r = capSlides(deck);
    const total = r.slides.reduce((n, s) => n + s.notes.length, 0);
    expect(total).toBe(20_000);
    expect(r.slides[0].notes).toHaveLength(2_000);
    expect(r.slides[9].notes).toHaveLength(2_000);
    expect(r.slides[10].notes).toBe("");
    expect(r.slides[11].notes).toBe("");
    expect(r.slides[11].title).toBe("T11"); // titles are kept
    expect(r.truncated).toBe(true);
  });

  it("reports no truncation for a normal deck", () => {
    expect(capSlides([slide("a", "A", "hi")])).toEqual({ slides: [slide("a", "A", "hi")], truncated: false });
  });
});

describe("presentationHasContent", () => {
  it("checks only the active mode", () => {
    const p = emptyPresentationPrep();
    expect(presentationHasContent(p)).toBe(false);
    expect(presentationHasContent({ ...p, notes: "  point one " })).toBe(true);
    expect(presentationHasContent({ ...p, mode: "slides", notes: "point one" })).toBe(false);
  });
  it("needs at least one slide with a title or notes in slides mode", () => {
    const p = { ...emptyPresentationPrep(), mode: "slides" as const };
    expect(presentationHasContent({ ...p, slides: [slide("a"), slide("b", "  ")] })).toBe(false);
    expect(presentationHasContent({ ...p, slides: [slide("a"), slide("b", "", "notes")] })).toBe(true);
  });
});

describe("normalizeSlideTimings", () => {
  const slides = [slide("a", "A"), slide("b", "B")];
  it("drops timings for slides that no longer exist and bad values", () => {
    expect(
      normalizeSlideTimings(
        [
          { slideId: "a", seconds: 12.4 },
          { slideId: "gone", seconds: 5 },
          { slideId: "b", seconds: -1 },
          { slideId: "b", seconds: "3" },
          null,
        ],
        slides,
      ),
    ).toEqual([{ slideId: "a", seconds: 12 }]);
  });
  it("caps seconds and entry count", () => {
    expect(normalizeSlideTimings([{ slideId: "a", seconds: 99_999 }], slides)).toEqual([
      { slideId: "a", seconds: 10_800 },
    ]);
    const many = Array.from({ length: 60 }, () => ({ slideId: "a", seconds: 1 }));
    expect(normalizeSlideTimings(many, slides).length).toBeLessThanOrEqual(40);
    expect(normalizeSlideTimings("x", slides)).toEqual([]);
  });
});

describe("normalizeTakeInput", () => {
  const good = {
    talkTitle: "Q3 review", durationSec: 305.7, transcript: "hello", feedback: "**Overall** ok",
    effective: { score: 70 }, nonverbal: null, slideTimings: [{ slideId: "a", seconds: 3 }],
  };
  it("normalizes a valid take", () => {
    const t = normalizeTakeInput(good)!;
    expect(t.durationSec).toBe(306);
    expect(t.talkTitle).toBe("Q3 review");
    expect(t.effective).toEqual({ score: 70 });
    expect(t.slideTimings).toEqual([{ slideId: "a", seconds: 3 }]);
  });
  it("rejects a take without transcript or feedback", () => {
    expect(normalizeTakeInput({ ...good, transcript: "  " })).toBeNull();
    expect(normalizeTakeInput({ ...good, feedback: "" })).toBeNull();
    expect(normalizeTakeInput(null)).toBeNull();
  });
  it("clamps and truncates", () => {
    const t = normalizeTakeInput({ ...good, durationSec: 1e9, transcript: "x".repeat(80_000), feedback: "y".repeat(50_000), talkTitle: "t".repeat(500) })!;
    expect(t.durationSec).toBe(10_800);
    expect(t.transcript).toHaveLength(60_000);
    expect(t.feedback).toHaveLength(40_000);
    expect(t.talkTitle).toHaveLength(120);
  });
});

describe("accumulateTimings", () => {
  it("gives the whole take to the slide showing when recording started", () => {
    expect(accumulateTimings([{ slideId: "a", at: 0 }], 1_000, 61_000)).toEqual([
      { slideId: "a", seconds: 60 },
    ]);
  });
  it("ignores slide changes before recording started", () => {
    const changes = [
      { slideId: "a", at: 0 },
      { slideId: "b", at: 500 },
      { slideId: "c", at: 900 },
    ];
    expect(accumulateTimings(changes, 1_000, 11_000)).toEqual([{ slideId: "c", seconds: 10 }]);
  });
  it("adds up revisits and rapid back-and-forth", () => {
    const changes = [
      { slideId: "a", at: 0 },
      { slideId: "b", at: 10_000 },
      { slideId: "a", at: 15_000 },
      { slideId: "b", at: 15_200 },
    ];
    expect(accumulateTimings(changes, 0, 20_000)).toEqual([
      { slideId: "a", seconds: 10 },
      { slideId: "b", seconds: 10 },
    ]);
  });
  it("ignores changes after recording stopped", () => {
    const changes = [{ slideId: "a", at: 0 }, { slideId: "b", at: 30_000 }];
    expect(accumulateTimings(changes, 0, 20_000)).toEqual([{ slideId: "a", seconds: 20 }]);
  });
  it("returns [] with no changes", () => {
    expect(accumulateTimings([], 0, 1_000)).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(160)).toBe("2:40");
    expect(formatDuration(3_725)).toBe("62:05");
  });
});

describe("transcript limit for real-length talks", () => {
  it("keeps a ~25-minute transcript (about 20,000 chars) intact", () => {
    const talk = "word ".repeat(4_000); // 20,000 chars ≈ 25 min at 150 wpm
    const t = normalizeTakeInput({ transcript: talk, feedback: "**Overall** ok" })!;
    expect(t.transcript).toHaveLength(20_000);
    expect(PRESENTATION_LIMITS.transcript).toBeGreaterThanOrEqual(60_000);
  });
});

describe("parseTimeLimit", () => {
  it("is null for blank or non-numeric input", () => {
    expect(parseTimeLimit("")).toBeNull();
    expect(parseTimeLimit("  ")).toBeNull();
    expect(parseTimeLimit("abc")).toBeNull();
  });
  it("clamps to 1-120 whole minutes instead of discarding", () => {
    expect(parseTimeLimit("0")).toBe(1);
    expect(parseTimeLimit("150")).toBe(120);
    expect(parseTimeLimit("7.6")).toBe(8);
    expect(parseTimeLimit("15")).toBe(15);
  });
});
