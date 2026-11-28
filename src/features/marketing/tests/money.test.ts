import { describe, expect, it } from "vitest";
import {
  fromBasisPoints,
  fromMinor,
  percentOf,
  round2,
  sum,
  toBasisPoints,
  toJson,
  toMinor,
} from "../utils/money";

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

describe("minor units and basis points (shared database)", () => {
  it("converts the story-k amounts exactly", () => {
    expect(toMinor(59.9)).toBe(5990);
    expect(toMinor("5.99")).toBe(599);
    expect(fromMinor(599).toString()).toBe("5.99");
    expect(toJson(fromMinor(5990))).toBe(59.9);
  });

  it("converts percentages to basis points", () => {
    expect(toBasisPoints(10)).toBe(1000);
    expect(toBasisPoints(12.5)).toBe(1250);
    expect(fromBasisPoints(1000).toString()).toBe("10");
  });

  it("rejects more than 2 decimal places instead of rounding", () => {
    expect(() => toMinor("0.005")).toThrow(RangeError);
    expect(() => toBasisPoints("10.125")).toThrow(RangeError);
  });
});
