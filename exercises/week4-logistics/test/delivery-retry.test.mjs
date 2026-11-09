// Task T1 – delivery retry: retry path + counter.
// Each test names the acceptance criterion from specs/delivery-retry/spec.md it checks.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  applyStatusUpdate,
  InvalidTransitionError,
  MAX_DELIVERY_ATTEMPTS,
} from "../src/shipment-status";

const at = (h) => `2026-11-01T${String(h).padStart(2, "0")}:00:00.000Z`;
const shipment = (status, failedAttempts, hour = 10) => ({
  shipmentId: "SHP-7",
  orderId: "ORD-7",
  carrierCode: "DHL",
  trackingNumber: "00340777",
  status,
  updatedAt: at(hour),
  ...(failedAttempts === undefined ? {} : { failedAttempts }),
});
const update = (status, hour) => ({
  shipmentId: "SHP-7",
  status,
  occurredAt: at(hour),
});

test("max delivery attempts is 3 (spec constraint)", () => {
  assert.equal(MAX_DELIVERY_ATTEMPTS, 3);
});

test("criterion 1: DELIVERY_FAILED -> OUT_FOR_DELIVERY is allowed below the limit", () => {
  const { shipment: next } = applyStatusUpdate(
    shipment("DELIVERY_FAILED", 1),
    update("OUT_FOR_DELIVERY", 11),
  );
  assert.equal(next.status, "OUT_FOR_DELIVERY");
});

test("criterion 2: DELIVERY_FAILED -> IN_TRANSIT is allowed below the limit", () => {
  const { shipment: next } = applyStatusUpdate(
    shipment("DELIVERY_FAILED", 1),
    update("IN_TRANSIT", 11),
  );
  assert.equal(next.status, "IN_TRANSIT");
});

test("criterion 3: first DELIVERY_FAILED sets failedAttempts to 1", () => {
  const { shipment: next } = applyStatusUpdate(
    shipment("OUT_FOR_DELIVERY", undefined),
    update("DELIVERY_FAILED", 11),
  );
  assert.equal(next.failedAttempts, 1);
});

test("criterion 3: each new DELIVERY_FAILED increases failedAttempts by 1", () => {
  const { shipment: next } = applyStatusUpdate(
    shipment("OUT_FOR_DELIVERY", 1),
    update("DELIVERY_FAILED", 11),
  );
  assert.equal(next.failedAttempts, 2);
});

test("criterion 3: a retry does not change failedAttempts", () => {
  const { shipment: next } = applyStatusUpdate(
    shipment("DELIVERY_FAILED", 2),
    update("IN_TRANSIT", 11),
  );
  assert.equal(next.failedAttempts, 2);
});

test("criterion 4: duplicate DELIVERY_FAILED webhook is not counted and emits no event", () => {
  const failed = shipment("DELIVERY_FAILED", 1, 11);
  const result = applyStatusUpdate(failed, update("DELIVERY_FAILED", 11));
  assert.equal(result.event, null);
  assert.equal(result.shipment.failedAttempts, 1);
});

test("criterion 7: DELIVERY_FAILED -> CANCELLED is rejected", () => {
  assert.throws(
    () =>
      applyStatusUpdate(
        shipment("DELIVERY_FAILED", 1),
        update("CANCELLED", 11),
      ),
    InvalidTransitionError,
  );
});

test("forbidden: DELIVERY_FAILED -> DELIVERED is rejected (no skipping OUT_FOR_DELIVERY)", () => {
  assert.throws(
    () =>
      applyStatusUpdate(
        shipment("DELIVERY_FAILED", 1),
        update("DELIVERED", 11),
      ),
    InvalidTransitionError,
  );
});

test("forbidden: IN_TRANSIT -> DELIVERY_FAILED is rejected (failure only from OUT_FOR_DELIVERY)", () => {
  assert.throws(
    () =>
      applyStatusUpdate(
        shipment("IN_TRANSIT", 1),
        update("DELIVERY_FAILED", 11),
      ),
    InvalidTransitionError,
  );
});

test("event fields are unchanged by T1 (attemptCount is task T3)", () => {
  const { event } = applyStatusUpdate(
    shipment("DELIVERY_FAILED", 1),
    update("IN_TRANSIT", 11),
  );
  assert.deepEqual(Object.keys(event).sort(), [
    "carrierCode",
    "orderId",
    "previousStatus",
    "shipmentId",
    "status",
    "trackingNumber",
    "updatedAt",
  ]);
});
