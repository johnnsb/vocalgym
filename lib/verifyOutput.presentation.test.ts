import { describe, expect, it } from "vitest";
import { verifyPresentationFeedback } from "./verifyOutput";

const FULL = [
  "**Overall** — Effective 72, Solid.",
  "**Coverage**",
  "- S1 Intro — covered: strong hook.",
  "**Flow & timing** — Ran 5:05 of 10.",
  "**Delivery** — Pace was quick.",
  "**For your next run**",
  "- Slow down on pricing.",
].join("\n");

describe("verifyPresentationFeedback", () => {
  it("accepts all required sections without Nonverbal", () => {
    expect(verifyPresentationFeedback(FULL).ok).toBe(true);
  });
  it("accepts 'Flow and timing' and ## headings", () => {
    const t = FULL.replace("**Flow & timing**", "## Flow and timing");
    expect(verifyPresentationFeedback(t).ok).toBe(true);
  });
  it("reports each missing section", () => {
    const r = verifyPresentationFeedback(FULL.replace("**Coverage**", "").replace("**Delivery** — Pace was quick.", ""));
    expect(r).toMatchObject({ ok: false, missing: ["Coverage", "Delivery"] });
  });
  it("does not let a ### subheading satisfy a section", () => {
    const t = FULL.replace("**For your next run**", "### Next run of the pilot?");
    expect(verifyPresentationFeedback(t)).toMatchObject({ ok: false, missing: ["For your next run"] });
  });
  it("rejects empty output", () => {
    expect(verifyPresentationFeedback("")).toMatchObject({ ok: false, reason: "empty-or-too-short" });
    expect(verifyPresentationFeedback(null).ok).toBe(false);
  });
});
