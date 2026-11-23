export const statuses = [
  "CREATED",
  "LABEL_CREATED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
  "CANCELLED",
] as const;
export type ShipmentStatus = (typeof statuses)[number];
export type Shipment = {
  shipmentId: string;
  orderId: string;
  customerId: string;
  carrierCode: string;
  trackingNumber: string;
  shippingMethod: "STANDARD" | "EXPRESS";
  status: ShipmentStatus;
  updatedAt: string;
  failedAttempts: number;
};
export type ShipmentEvent = {
  shipmentId: string;
  orderId: string;
  carrierCode: string;
  trackingNumber: string;
  previousStatus: ShipmentStatus;
  status: ShipmentStatus;
  updatedAt: string;
  attemptCount?: number;
};
export type ShipmentList = {
  data: Shipment[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
