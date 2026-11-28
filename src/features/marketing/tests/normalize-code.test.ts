import { describe, expect, it } from "vitest";
import { normalizeCode } from "../utils/normalize-code";

describe("normalizeCode", () => {
  it("stores codes in uppercase so that uniqueness is case-insensitive", () => {
    expect(normalizeCode("spring10")).toBe("SPRING10");
    expect(normalizeCode("SpRiNg10")).toBe("SPRING10");
  });

  it("ignores surrounding spaces", () => {
    expect(normalizeCode("  SPRING10 ")).toBe("SPRING10");
  });
});
