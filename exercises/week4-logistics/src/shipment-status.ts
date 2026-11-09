import type {
  CarrierStatusUpdate,
  Shipment,
  ShipmentStatus,
  ShipmentStatusChanged,
} from "./contracts";

/** Only these direct edges are valid. */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<ShipmentStatus, readonly ShipmentStatus[]>
> = {
  CREATED: ["LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "IN_TRANSIT", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

export const TERMINAL_STATUSES: readonly ShipmentStatus[] = [
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

/** Failed delivery attempts before the shipment goes back to the sender (spec: delivery-retry). */
export const MAX_DELIVERY_ATTEMPTS = 3;

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: ShipmentStatus,
    public readonly to: ShipmentStatus,
  ) {
    super(`Invalid shipment status transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class StaleEventError extends Error {
  constructor(
    public readonly occurredAt: string,
    public readonly updatedAt: string,
  ) {
    super(
      `Stale status event at ${occurredAt}; shipment already updated at ${updatedAt}`,
    );
    this.name = "StaleEventError";
  }
}

export class InvalidTimestampError extends Error {
  constructor(public readonly value: string) {
    super(`Timestamp is not canonical UTC ISO-8601: ${value}`);
    this.name = "InvalidTimestampError";
  }
}

export class ShipmentMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly received: string,
  ) {
    super(`Update for shipment ${received} applied to shipment ${expected}`);
    this.name = "ShipmentMismatchError";
  }
}

export function isAllowedTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function assertCanonicalUtc(value: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new InvalidTimestampError(value);
  }
}

export interface StatusUpdateResult {
  shipment: Shipment;
  /** null when the update was a duplicate (idempotent no-op). */
  event: ShipmentStatusChanged | null;
}

/**
 * Applies a carrier status observation to a shipment.
 * Pure: returns a new shipment and the outbound event; never mutates input.
 */
export function applyStatusUpdate(
  shipment: Shipment,
  update: CarrierStatusUpdate,
): StatusUpdateResult {
  if (update.shipmentId !== shipment.shipmentId) {
    throw new ShipmentMismatchError(shipment.shipmentId, update.shipmentId);
  }
  assertCanonicalUtc(update.occurredAt);

  // Repeated webhook: same status at the same time -> idempotent no-op.
  if (
    update.status === shipment.status &&
    update.occurredAt === shipment.updatedAt
  ) {
    return { shipment, event: null };
  }
  if (update.occurredAt < shipment.updatedAt) {
    throw new StaleEventError(update.occurredAt, shipment.updatedAt);
  }
  if (!isAllowedTransition(shipment.status, update.status)) {
    throw new InvalidTransitionError(shipment.status, update.status);
  }

  const previousFailures = shipment.failedAttempts ?? 0;
  const next: Shipment = {
    ...shipment,
    status: update.status,
    updatedAt: update.occurredAt,
    failedAttempts:
      update.status === "DELIVERY_FAILED"
        ? previousFailures + 1
        : previousFailures,
  };
  const event: ShipmentStatusChanged = {
    shipmentId: next.shipmentId,
    orderId: next.orderId,
    carrierCode: next.carrierCode,
    trackingNumber: next.trackingNumber,
    previousStatus: shipment.status,
    status: next.status,
    updatedAt: next.updatedAt,
  };
  return { shipment: next, event };
}
