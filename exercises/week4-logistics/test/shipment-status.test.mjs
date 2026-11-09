import { test } from "vitest";
import assert from "node:assert/strict";
import {
  applyStatusUpdate,
  isAllowedTransition,
  InvalidTransitionError,
  StaleEventError,
  InvalidTimestampError,
  ShipmentMismatchError,
} from "../src/shipment-status";

const base = {
  shipmentId: "SHP-1",
  orderId: "ORD-1",
  carrierCode: "DHL",
  trackingNumber: "00340434",
  status: "CREATED",
  updatedAt: "2026-11-01T08:00:00.000Z",
};
const at = (h) => `2026-11-01T${String(h).padStart(2, "0")}:00:00.000Z`;

test("CREATED -> LABEL_CREATED is allowed", () => {
  const { shipment } = applyStatusUpdate(base, {
    shipmentId: "SHP-1",
    status: "LABEL_CREATED",
    occurredAt: at(9),
  });
  assert.equal(shipment.status, "LABEL_CREATED");
});

test("CREATED -> DELIVERED is rejected (not a direct edge)", () => {
  assert.throws(
    () =>
      applyStatusUpdate(base, {
        shipmentId: "SHP-1",
        status: "DELIVERED",
        occurredAt: at(9),
      }),
    InvalidTransitionError,
  );
});

test("OUT_FOR_DELIVERY -> DELIVERY_FAILED is allowed", () => {
  assert.equal(
    isAllowedTransition("OUT_FOR_DELIVERY", "DELIVERY_FAILED"),
    true,
  );
});

test("DELIVERY_FAILED -> OUT_FOR_DELIVERY is allowed (retryable)", () => {
  assert.equal(
    isAllowedTransition("DELIVERY_FAILED", "OUT_FOR_DELIVERY"),
    true,
  );
});

test("CANCELLED is terminal", () => {
  const s = { ...base, status: "CANCELLED" };
  assert.throws(
    () =>
      applyStatusUpdate(s, {
        shipmentId: "SHP-1",
        status: "LABEL_CREATED",
        occurredAt: at(9),
      }),
    InvalidTransitionError,
  );
});

test("RETURNED is terminal", () => {
  assert.equal(isAllowedTransition("RETURNED", "OUT_FOR_DELIVERY"), false);
});

test("event carries exact fields and keeps orderId and shipmentId apart", () => {
  const { event } = applyStatusUpdate(base, {
    shipmentId: "SHP-1",
    status: "LABEL_CREATED",
    occurredAt: at(9),
  });
  assert.deepEqual(event, {
    shipmentId: "SHP-1",
    orderId: "ORD-1",
    carrierCode: "DHL",
    trackingNumber: "00340434",
    previousStatus: "CREATED",
    status: "LABEL_CREATED",
    updatedAt: at(9),
  });
});

test("repeated webhook is idempotent: no event, shipment unchanged", () => {
  const s = { ...base, status: "LABEL_CREATED", updatedAt: at(9) };
  const result = applyStatusUpdate(s, {
    shipmentId: "SHP-1",
    status: "LABEL_CREATED",
    occurredAt: at(9),
  });
  assert.equal(result.event, null);
  assert.equal(result.shipment, s);
});

test("stale event is rejected", () => {
  const s = { ...base, status: "LABEL_CREATED", updatedAt: at(9) };
  assert.throws(
    () =>
      applyStatusUpdate(s, {
        shipmentId: "SHP-1",
        status: "IN_TRANSIT",
        occurredAt: at(7),
      }),
    StaleEventError,
  );
});

test("non-canonical timestamp is rejected", () => {
  assert.throws(
    () =>
      applyStatusUpdate(base, {
        shipmentId: "SHP-1",
        status: "LABEL_CREATED",
        occurredAt: "2026-11-01 09:00",
      }),
    InvalidTimestampError,
  );
});

test("update for another shipment is rejected", () => {
  assert.throws(
    () =>
      applyStatusUpdate(base, {
        shipmentId: "SHP-2",
        status: "LABEL_CREATED",
        occurredAt: at(9),
      }),
    ShipmentMismatchError,
  );
});

test("input shipment is not mutated", () => {
  const copy = { ...base };
  applyStatusUpdate(base, {
    shipmentId: "SHP-1",
    status: "LABEL_CREATED",
    occurredAt: at(9),
  });
  assert.deepEqual(base, copy);
});
