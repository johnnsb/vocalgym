import { describe, expect, it } from "vitest";
import { PRESENTATION_RUBRIC } from "./rubric";
import { RUBRIC_ATTRIBUTES, TONES } from "./types";

describe("PRESENTATION_RUBRIC", () => {
  it("is Clear 30 · Confident 25 · Connected 25 · Smooth 20", () => {
    expect(PRESENTATION_RUBRIC.attributes).toEqual(["clear", "confident", "connected", "smooth"]);
    expect(PRESENTATION_RUBRIC.weights).toEqual({ clear: 30, confident: 25, connected: 25, smooth: 20 });
    expect(PRESENTATION_RUBRIC.custom).toBe(false);
  });
  it("uses valid attributes and weights summing to 100", () => {
    for (const a of PRESENTATION_RUBRIC.attributes) expect(RUBRIC_ATTRIBUTES).toContain(a);
    expect(Object.values(PRESENTATION_RUBRIC.weights).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("is not a tone", () => {
    expect(TONES as readonly string[]).not.toContain("presenting");
  });
});
