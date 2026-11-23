import { describe, it, expect } from "vitest";
import {
  createSchema,
  updateSchema,
  filterSchema,
} from "../schemas/gateway.schema";
describe("Session 5 boundary compatibility", () => {
  it("rejects paymentReference until the Accounting contract is agreed", () => {
    const body = {
      orderId: "O-1",
      customerId: "C-1",
      paymentStatus: "PAID",
      shippingMethod: "STANDARD",
      shippingAddress: {
        recipientName: "Erika",
        street: "A",
        postalCode: "1",
        city: "D",
        country: "DE",
      },
    };
    expect(createSchema.safeParse(body).success).toBe(true);
    expect(
      createSchema.safeParse({ ...body, paymentReference: "PAY-1" }).success,
    ).toBe(false);
    expect(
      createSchema.safeParse({ ...body, shippingMethod: "standard" }).success,
    ).toBe(false);
  });
  it("rejects impossible and noncanonical carrier times", () => {
    for (const occurredAt of [
      "2026-02-30T09:00:00.000Z",
      "2026-11-17T09:00:00Z",
      "tomorrow",
    ])
      expect(
        updateSchema.safeParse({ status: "DELIVERED", occurredAt }).success,
      ).toBe(false);
    expect(
      updateSchema.safeParse({
        status: "LABEL_CREATED",
        occurredAt: "2026-11-17T09:00:00.000Z",
      }).success,
    ).toBe(true);
  });
  it("rejects unknown filter keys and invalid pagination", () => {
    expect(filterSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(filterSchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(filterSchema.safeParse({ secret: "x" }).success).toBe(false);
    expect(filterSchema.safeParse({ orderId: "M-1", page: "1" }).success).toBe(
      true,
    );
  });
});
