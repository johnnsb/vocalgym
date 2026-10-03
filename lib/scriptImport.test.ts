import { describe, expect, it } from "vitest";
import { MAX_SCRIPT_CHARS, extractScriptText } from "./scriptImport";

describe("extractScriptText maxChars", () => {
  const long = new File(["x".repeat(13_000)], "notes.txt", { type: "text/plain" });

  it("keeps the 8,000-char default for existing callers", async () => {
    const r = await extractScriptText(long);
    expect(r.text).toHaveLength(MAX_SCRIPT_CHARS);
    expect(r.truncated).toBe(true);
  });

  it("accepts a larger cap (presentation notes allow 12,000)", async () => {
    const r = await extractScriptText(long, { maxChars: 12_000 });
    expect(r.text).toHaveLength(12_000);
    expect(r.truncated).toBe(true);
    const fits = await extractScriptText(new File(["y".repeat(10_000)], "n.txt", { type: "text/plain" }), { maxChars: 12_000 });
    expect(fits).toEqual({ text: "y".repeat(10_000), truncated: false });
  });
});
