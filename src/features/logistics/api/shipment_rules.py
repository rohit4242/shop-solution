"""Core rules of the Logistics module. The API is the only caller; the MCP server must not import this.

Pure functions: nothing here mutates its input, reads a clock, or does I/O.
Ported from the week-4 shipment-status.ts and the delivery-retry spec (criteria 1-7).
"""

import re
from dataclasses import dataclass, replace
from datetime import datetime

ALLOWED_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "CREATED": ("LABEL_CREATED", "CANCELLED"),
    "LABEL_CREATED": ("IN_TRANSIT", "CANCELLED"),
    "IN_TRANSIT": ("OUT_FOR_DELIVERY",),
    "OUT_FOR_DELIVERY": ("DELIVERED", "DELIVERY_FAILED"),
    "DELIVERY_FAILED": ("OUT_FOR_DELIVERY", "IN_TRANSIT", "RETURNED"),
    "DELIVERED": (),
    "RETURNED": (),
    "CANCELLED": (),
}

MAX_DELIVERY_ATTEMPTS = 3

CARRIER_BY_METHOD = {"STANDARD": "DHL", "EXPRESS": "UPS"}

# Delivery options offered to Storefront's checkout (contract 1.2.0, listShippingMethods).
# The carrier always matches CARRIER_BY_METHOD, so the shipment later gets the carrier the customer saw.
# Prices and delivery times are demo values for this shop, in EUR minor units (499 = 4.99 EUR).
SHIPPING_METHODS = (
    {
        "code": "STANDARD",
        "carrierCode": CARRIER_BY_METHOD["STANDARD"],
        "name": "Standard delivery",
        "description": "Delivered by DHL in 2 to 4 working days.",
        "estimatedDeliveryDays": {"min": 2, "max": 4},
        "price": {"amountMinor": 499, "currency": "EUR"},
    },
    {
        "code": "EXPRESS",
        "carrierCode": CARRIER_BY_METHOD["EXPRESS"],
        "name": "Express delivery",
        "description": "Delivered by UPS in 1 to 2 working days.",
        "estimatedDeliveryDays": {"min": 1, "max": 2},
        "price": {"amountMinor": 1299, "currency": "EUR"},
    },
)

_CANONICAL_UTC = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$")


class InvalidTransitionError(Exception):
    def __init__(self, old: str, new: str):
        super().__init__(f"Invalid shipment status transition {old} -> {new}")
        self.old, self.new = old, new


class StaleEventError(Exception):
    def __init__(self, occurred_at: str, updated_at: str):
        super().__init__(f"Stale update at {occurred_at}; shipment was already updated at {updated_at}")


class InvalidTimestampError(Exception):
    def __init__(self, value: str):
        super().__init__(f"Timestamp must be UTC like 2026-11-10T09:00:00.000Z, got {value!r}")


@dataclass(frozen=True)
class Shipment:
    shipment_id: str
    order_id: str
    customer_id: str
    carrier_code: str
    tracking_number: str
    shipping_method: str
    status: str
    updated_at: str
    failed_attempts: int = 0
    # Every carrier observation (status, occurredAt) applied so far. A re-delivered webhook is a no-op,
    # even after later updates or after the automatic return changed the shipment status.
    observations: frozenset[tuple[str, str]] = frozenset()


@dataclass(frozen=True)
class UpdateResult:
    shipment: Shipment
    events: list[dict]


def create_shipment(shipment_id: str, order_id: str, customer_id: str, shipping_method: str, now: str) -> Shipment:
    return Shipment(
        shipment_id=shipment_id,
        order_id=order_id,
        customer_id=customer_id,
        carrier_code=CARRIER_BY_METHOD[shipping_method],
        tracking_number="TRK-" + shipment_id.removeprefix("S-"),
        shipping_method=shipping_method,
        status="CREATED",
        updated_at=now,
    )


def _assert_canonical_utc(value: str) -> None:
    if not _CANONICAL_UTC.match(value):
        raise InvalidTimestampError(value)
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise InvalidTimestampError(value) from None


def _event(old: Shipment, new: Shipment) -> dict:
    return {
        "shipmentId": new.shipment_id,
        "orderId": new.order_id,
        "carrierCode": new.carrier_code,
        "trackingNumber": new.tracking_number,
        "previousStatus": old.status,
        "status": new.status,
        "updatedAt": new.updated_at,
        "attemptCount": new.failed_attempts,
    }


def apply_status_update(shipment: Shipment, status: str, occurred_at: str) -> UpdateResult:
    _assert_canonical_utc(occurred_at)

    if (status, occurred_at) in shipment.observations:
        return UpdateResult(shipment, [])
    if occurred_at < shipment.updated_at:
        raise StaleEventError(occurred_at, shipment.updated_at)
    if status not in ALLOWED_TRANSITIONS[shipment.status]:
        raise InvalidTransitionError(shipment.status, status)

    failed = shipment.failed_attempts + (1 if status == "DELIVERY_FAILED" else 0)
    applied = replace(
        shipment,
        status=status,
        updated_at=occurred_at,
        failed_attempts=failed,
        observations=shipment.observations | {(status, occurred_at)},
    )
    events = [_event(shipment, applied)]

    if status == "DELIVERY_FAILED" and failed >= MAX_DELIVERY_ATTEMPTS:
        returned = replace(applied, status="RETURNED")
        events.append(_event(applied, returned))
        applied = returned

    return UpdateResult(applied, events)
