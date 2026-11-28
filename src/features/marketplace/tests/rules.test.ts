import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  detectImageType,
  encodeCursor,
  isPublic,
  planOfferUpdate,
  totals,
  type OfferState,
} from "../server/services/rules";
import { MarketplaceError } from "../server/errors";

const offer = (patch: Partial<OfferState> = {}): OfferState => ({
  status: "active",
  name: "Stoneware mug",
  description: "Hand-thrown.",
  category: "home_kitchen",
  attributes: { colour: "sand" },
  imageIds: ["img_a"],
  priceMinor: 1999,
  stock: 12,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  weightGrams: null,
  variations: [],
  ...patch,
});
const newId = () => "var_new";

function codeOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof MarketplaceError) return error.code;
    throw error;
  }
  return null;
}

describe("public visibility", () => {
  it("needs an active offer of an active shop", () => {
    expect(isPublic("active", "active")).toBe(true);
    expect(isPublic("active", "pending")).toBe(false);
    expect(isPublic("active", "suspended")).toBe(false);
    expect(isPublic("pending", "active")).toBe(false);
  });
});

describe("totals", () => {
  it("uses the cheapest variation and the stock sum", () => {
    expect(
      totals(
        [
          { priceMinor: 2500, stock: 2 },
          { priceMinor: 1900, stock: 3 },
        ],
        { priceMinor: 9999, stock: 99 },
      ),
    ).toEqual({ priceMinor: 1900, stock: 5 });
  });
  it("keeps the base price and stock without variations", () => {
    expect(totals([], { priceMinor: 1999, stock: 4 })).toEqual({
      priceMinor: 1999,
      stock: 4,
    });
  });
});

describe("planOfferUpdate", () => {
  it("keeps an active offer live when only price and stock change", () => {
    const plan = planOfferUpdate(
      offer(),
      { priceMinor: 2490, stock: 9 },
      newId,
    );
    expect(plan).toMatchObject({
      status: "active",
      priceMinor: 2490,
      stock: 9,
    });
    expect(plan.statusReason).toBeUndefined();
  });

  it.each([
    [{ name: "Big mug" }],
    [{ description: "New text." }],
    [{ category: "other" as const }],
    [{ attributes: { colour: "blue" } }],
    [{ imageIds: ["img_b"] }],
    [{ weightGrams: 350 }],
  ])(
    "sends an active offer back to review when content changes: %o",
    (input) => {
      const plan = planOfferUpdate(offer(), input, newId);
      expect(plan.status).toBe("pending");
      expect(plan.statusReason).toBeNull();
    },
  );

  it("does not re-review when content is sent unchanged", () => {
    expect(
      planOfferUpdate(offer(), { name: "Stoneware mug" }, newId).status,
    ).toBe("active");
  });

  it("resubmits a rejected offer on any edit and clears the reason", () => {
    const plan = planOfferUpdate(
      offer({ status: "rejected" }),
      { stock: 3 },
      newId,
    );
    expect(plan).toMatchObject({ status: "pending", statusReason: null });
  });

  it.each(["blocked", "removed"] as const)("locks %s offers", (status) => {
    expect(
      codeOf(() => planOfferUpdate(offer({ status }), { stock: 1 }, newId)),
    ).toBe("OFFER_LOCKED");
  });

  it("derives price and stock from new variations and gives them IDs", () => {
    const plan = planOfferUpdate(
      offer(),
      {
        variations: [
          { label: "S", priceMinor: 2100, stock: 1, imageIds: [] },
          { label: "M", priceMinor: 1800, stock: 4, imageIds: [] },
        ],
      },
      newId,
    );
    expect(plan).toMatchObject({
      priceMinor: 1800,
      stock: 5,
      status: "pending",
    });
    expect(plan.variations.map((v) => v.id)).toEqual(["var_new", "var_new"]);
  });

  it("keeps the review status when only variation price or stock changes", () => {
    const current = offer({
      variations: [
        { id: "var_1", label: "S", priceMinor: 2000, stock: 1, imageIds: [] },
      ],
    });
    const plan = planOfferUpdate(
      current,
      {
        variations: [
          {
            variationId: "var_1",
            label: "S",
            priceMinor: 2200,
            stock: 7,
            imageIds: [],
          },
        ],
      },
      newId,
    );
    expect(plan).toMatchObject({
      status: "active",
      priceMinor: 2200,
      stock: 7,
    });
  });

  it("rejects unknown or repeated variation IDs", () => {
    const current = offer({
      variations: [
        { id: "var_1", label: "S", priceMinor: 2000, stock: 1, imageIds: [] },
      ],
    });
    const twice = {
      variationId: "var_1",
      label: "S",
      priceMinor: 2000,
      stock: 1,
      imageIds: [],
    };
    expect(
      codeOf(() =>
        planOfferUpdate(current, { variations: [twice, twice] }, newId),
      ),
    ).toBe("VALIDATION_ERROR");
    expect(
      codeOf(() =>
        planOfferUpdate(
          current,
          { variations: [{ ...twice, variationId: "var_x" }] },
          newId,
        ),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("needs a stock when variations are turned off, and keeps their cheapest price", () => {
    const current = offer({
      priceMinor: 1500,
      variations: [
        { id: "var_1", label: "S", priceMinor: 1500, stock: 1, imageIds: [] },
      ],
    });
    expect(
      codeOf(() => planOfferUpdate(current, { variations: [] }, newId)),
    ).toBe("VALIDATION_ERROR");
    expect(
      planOfferUpdate(current, { variations: [], stock: 6 }, newId),
    ).toMatchObject({
      variations: [],
      stock: 6,
      priceMinor: 1500,
    });
  });

  it("clears a measurement with null", () => {
    const plan = planOfferUpdate(
      offer({ status: "pending", lengthCm: 12 }),
      { lengthCm: null },
      newId,
    );
    expect(plan.lengthCm).toBeNull();
  });
});

describe("catalog cursor", () => {
  it("round-trips and rejects anything else", () => {
    const at = new Date("2026-11-27T09:00:00.123Z");
    expect(decodeCursor(encodeCursor(at, "off_abc"))).toEqual({
      updatedAt: at,
      offerId: "off_abc",
    });
    expect(codeOf(() => decodeCursor("not-a-cursor"))).toBe("VALIDATION_ERROR");
  });
});

describe("detectImageType", () => {
  const pad = (bytes: number[]) =>
    new Uint8Array([...bytes, ...new Array(16).fill(0)]);
  it("recognises JPG, PNG and WEBP and nothing else", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(
      detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(
      detectImageType(
        pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
    expect(detectImageType(pad([0x3c, 0x73, 0x76, 0x67]))).toBeNull(); // <svg
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
