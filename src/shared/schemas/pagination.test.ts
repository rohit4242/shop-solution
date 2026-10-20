import { describe, expect, it } from "vitest";
import { paginationSchema } from "./pagination";
describe("pagination inputs", () => {
  it("uses bounded defaults and parses query strings", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.parse({ page: "2", pageSize: "50" })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });
  it("rejects invalid or excessive requests", () => {
    for (const input of [
      { page: 0 },
      { page: "abc" },
      { page: 1.5 },
      { pageSize: 101 },
    ]) {
      expect(paginationSchema.safeParse(input).success).toBe(false);
    }
  });
});
