import { describe, expect, it } from "vitest";
import { errorSummary } from "./logger";

describe("errorSummary", () => {
  it("turns a multi-line Prisma error into one readable line with its code", () => {
    const err = Object.assign(
      new Error(
        "\nInvalid `prisma.presentationPrep.findUnique()` invocation:\n\n\nCan't reach database server at `db.example:5432`\n\nPlease make sure your database server is running at `db.example:5432`.",
      ),
      { code: "P1001" },
    );
    expect(errorSummary(err)).toBe(
      "P1001 Can't reach database server at `db.example:5432` Please make sure your database server is running at `db.example:5432`.",
    );
  });

  it("collapses whitespace in ordinary errors", () => {
    expect(errorSummary(new Error("  boom\n  happened "))).toBe("boom happened");
  });

  it("handles non-Error values and empty messages", () => {
    expect(errorSummary("plain")).toBe("plain");
    expect(errorSummary(new Error(""))).toBe("Error");
    expect(errorSummary(undefined)).toBe("undefined");
  });

  it("caps very long messages", () => {
    expect(errorSummary(new Error("x".repeat(1000))).length).toBeLessThanOrEqual(300);
  });
});
