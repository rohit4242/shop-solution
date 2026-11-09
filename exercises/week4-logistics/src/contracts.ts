// Proposed cross-module contracts (partner confirmation pending).

export type ShipmentStatus =
  | "CREATED"
  | "LABEL_CREATED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURNED"
  | "CANCELLED";

export type ShippingMethod = "STANDARD" | "EXPRESS";

/** Inbound from the order / accounting boundary. */
export interface OrderReadyForShipping {
  orderId: string;
  customerId: string;
  paymentStatus: "PAID";
  shippingAddress: {
    fullName: string;
    street: string;
    postalCode: string;
    city: string;
    countryCode: string;
  };
  shippingMethod: ShippingMethod;
}

/** Logistics-owned shipment record. */
export interface Shipment {
  shipmentId: string;
  orderId: string;
  carrierCode: string;
  trackingNumber: string;
  status: ShipmentStatus;
  /** Canonical UTC ISO-8601 timestamp of the last applied status. */
  updatedAt: string;
  /** Number of DELIVERY_FAILED events applied so far; missing = 0. */
  failedAttempts?: number;
}

/** A status observation reported by a carrier webhook. */
export interface CarrierStatusUpdate {
  shipmentId: string;
  status: ShipmentStatus;
  /** UTC ISO-8601 time the carrier observed the status. */
  occurredAt: string;
}

/** Outbound to Accounting / Storefront. */
export interface ShipmentStatusChanged {
  shipmentId: string;
  orderId: string;
  carrierCode: string;
  trackingNumber: string;
  previousStatus: ShipmentStatus;
  status: ShipmentStatus;
  updatedAt: string;
}
