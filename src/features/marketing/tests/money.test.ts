import { describe, expect, it } from "vitest";
import { percentOf, round2, sum, toJson } from "../utils/money";

describe("money", () => {
  it("avoids floating point errors", () => {
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
  });

  it("rounds half up to 2 places", () => {
    expect(round2("1.995").toString()).toBe("2");
    expect(round2("1.994").toString()).toBe("1.99");
  });

  it("takes a percentage, rounded", () => {
    expect(percentOf("19.99", 10).toString()).toBe("2");
    expect(percentOf("59.90", 15).toString()).toBe("8.99");
  });

  it("serialises to a number with 2 places", () => {
    expect(toJson("59.9")).toBe(59.9);
  });
});
