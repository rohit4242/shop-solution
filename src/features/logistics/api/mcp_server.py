"""MCP server in front of the Logistics API. It only translates: one tool = one HTTP request.

There is no business logic here. All rules live in the API (shipment_rules.py).
Run with the MCP Inspector:  mcp dev mcp_server.py
The API address comes from LOGISTICS_API_BASE_URL (default http://localhost:8000).

Read-only mode (session 7 safeguard): start with --read-only, or set LOGISTICS_MCP_READ_ONLY=1.
The two writing tools (create_shipment, apply_status_update) are then not registered at all, so an
agent cannot change data, whatever text it reads. Every tool also carries the MCP readOnlyHint
annotation, so a host can ask for confirmation before a writing call.
"""

import os
import sys
from pathlib import Path
from typing import Annotated, Literal

import httpx
from pydantic import Field

try:  # MCP Python SDK version 2 renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:  # MCP Python SDK version 1
    from mcp.server.fastmcp import FastMCP

ShipmentStatus = Literal[
    "CREATED", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY",
    "DELIVERED", "DELIVERY_FAILED", "RETURNED", "CANCELLED",
]

# Same pattern as the contract. Also keeps one tool = one fixed request: an id like "S-2001/events" is rejected.
ShipmentId = Annotated[str, Field(pattern=r"^S-[0-9]{4,}$", description='Shipment id, e.g. "S-2001"')]

try:
    from mcp.types import ToolAnnotations
except ImportError:  # very old SDKs: no annotations
    ToolAnnotations = None

READ_ONLY = "--read-only" in sys.argv[1:] or os.environ.get("LOGISTICS_MCP_READ_ONLY") == "1"

mcp = FastMCP("logistics")


def read_tool():
    """Register a tool that only reads."""
    if ToolAnnotations is None:
        return mcp.tool()
    return mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))


def write_tool():
    """Register a tool that changes data, unless the server runs read-only."""
    def register(fn):
        if READ_ONLY:
            return fn  # not registered: the tool does not exist for the agent
        if ToolAnnotations is None:
            return mcp.tool()(fn)
        return mcp.tool(annotations=ToolAnnotations(readOnlyHint=False))(fn)
    return register


def _call(method: str, path: str, **kwargs) -> str:
    """Send one request to the Logistics API. Always returns text, so the model can read errors."""
    base_url = os.environ.get("LOGISTICS_API_BASE_URL", "http://localhost:8000").rstrip("/")
    try:
        response = httpx.request(method, base_url + path, timeout=10, **kwargs)
    except httpx.HTTPError as e:
        return f"ERROR: cannot reach the Logistics API at {base_url} ({type(e).__name__}). Is it running?"
    if response.is_success:
        return response.text
    try:
        error = response.json()["error"]
        return f"ERROR {response.status_code} {error['code']}: {error['message']}"
    except (ValueError, KeyError, TypeError):
        return f"ERROR {response.status_code}: {response.text}"


@mcp.resource("openapi://logistics", mime_type="application/yaml")
def openapi_contract() -> str:
    """The OpenAPI contract of the Logistics API (all operations, fields, enums, error codes)."""
    return (Path(__file__).parent / "openapi.yaml").read_text(encoding="utf-8")


@write_tool()
def create_shipment(
    order_id: str,
    customer_id: str,
    payment_status: Literal["PAID"],
    recipient_name: str,
    street: str,
    postal_code: str,
    city: str,
    country: str,
    shipping_method: Literal["STANDARD", "EXPRESS"],
    payment_reference: str | None = None,
) -> str:
    """Create a shipment for an order that is paid and ready to ship.

    Use this once per order. An order can only have one shipment; a second call for the same order fails with
    ORDER_ALREADY_HAS_SHIPMENT. Do not use it to change an existing shipment.

    Arguments:
    - order_id: the ORDER id: "O-" plus digits from the Storefront (e.g. "O-1001"), "M-" plus digits from the Marketplace (e.g. "M-2001") or "ORD-" plus digits from Accounting (e.g. "ORD-100001"). Not a shipment id.
    - customer_id: the customer id, any non-empty text, e.g. "C-501".
    - payment_status: must be "PAID". Only paid orders can be shipped.
    - recipient_name, street, postal_code, city: the delivery address, e.g. "Erika Mustermann", "Hauptstrasse 1", "94469", "Deggendorf".
    - country: 2 capital letters (ISO code), e.g. "DE". Not "Germany".
    - shipping_method: "STANDARD" or "EXPRESS", in capitals.
    - payment_reference: optional. Only if the user or Accounting gave one, e.g. "PAY-1". Never invent one.

    Returns the new shipment as JSON: shipmentId (format "S-2001", use it for all later calls), orderId,
    customerId, carrierCode, trackingNumber, shippingMethod, status ("CREATED"), updatedAt, failedAttempts (0).
    On failure returns a text starting with "ERROR" and the reason.
    """
    order = {
        "orderId": order_id,
        "customerId": customer_id,
        "paymentStatus": payment_status,
        "shippingAddress": {
            "recipientName": recipient_name,
            "street": street,
            "postalCode": postal_code,
            "city": city,
            "country": country,
        },
        "shippingMethod": shipping_method,
    }
    if payment_reference is not None:
        order["paymentReference"] = payment_reference
    return _call("POST", "/shipments", json=order)


@read_tool()
def get_shipment(shipment_id: ShipmentId) -> str:
    """Get one shipment when you know its shipment id.

    Use this to check the current status, the carrier, the tracking number or the number of failed deliveries.
    If you only know the ORDER id, use list_shipments with order_id instead.

    Arguments:
    - shipment_id: format "S-" plus at least 4 digits, e.g. "S-2001". An order id like "O-1001" is wrong here.

    Returns the shipment as JSON: shipmentId, orderId, customerId, carrierCode, trackingNumber, shippingMethod,
    status, updatedAt, failedAttempts. If it does not exist, returns "ERROR 404 SHIPMENT_NOT_FOUND: ...".
    """
    return _call("GET", f"/shipments/{shipment_id}")


@read_tool()
def list_shipments(
    order_id: str | None = None,
    customer_id: str | None = None,
    status: ShipmentStatus | None = None,
    page: int = 1,
    page_size: int = 20,
) -> str:
    """List shipments, optionally filtered. Use this to find a shipment when you only know the order id.

    Arguments (all optional):
    - order_id: only shipments of this order, e.g. "O-1001".
    - customer_id: only shipments of this customer, e.g. "C-501".
    - status: only shipments with this status.
    - page: page number starting at 1. page_size: 1 to 100.

    Returns JSON {"data": [shipments], "pagination": {page, pageSize, totalItems, totalPages}}.
    An empty "data" list means nothing matched; that is not an error.
    """
    params: dict = {"page": page, "pageSize": page_size}
    if order_id is not None:
        params["orderId"] = order_id
    if customer_id is not None:
        params["customerId"] = customer_id
    if status is not None:
        params["status"] = status
    return _call("GET", "/shipments", params=params)


@write_tool()
def apply_status_update(shipment_id: ShipmentId, status: ShipmentStatus, occurred_at: str) -> str:
    """Report a new status for a shipment, as the carrier would. Use this to move a shipment forward.

    Only direct steps are allowed: CREATED -> LABEL_CREATED or CANCELLED; LABEL_CREATED -> IN_TRANSIT or CANCELLED;
    IN_TRANSIT -> OUT_FOR_DELIVERY; OUT_FOR_DELIVERY -> DELIVERED or DELIVERY_FAILED;
    DELIVERY_FAILED -> OUT_FOR_DELIVERY, IN_TRANSIT or RETURNED. DELIVERED, RETURNED and CANCELLED are final.
    You cannot skip a step. After the 3rd DELIVERY_FAILED the shipment becomes RETURNED automatically.

    IMPORTANT: if this returns ERROR 409 INVALID_TRANSITION, the status you were asked to set is not allowed from the
    shipment's current status. Do NOT work around it by applying other statuses or by making up the missing
    steps or their times: each call writes a real carrier event that cannot be undone. Only apply statuses and
    times the user gave you. Tell the user about the error and the current status, and ask how to proceed.

    Arguments:
    - shipment_id: format "S-2001" (a shipment id, not an order id).
    - status: the new status, in capitals.
    - occurred_at: when the carrier saw it, in UTC with milliseconds and a trailing Z, e.g.
      "2026-11-10T09:00:00.000Z". It must not be earlier than the shipment's last update (check
      updatedAt with get_shipment first if unsure).

    Returns JSON {"shipment": {...}, "events": [...]}. "events" is empty if the same update was already
    applied. On failure returns "ERROR 409 INVALID_TRANSITION", "ERROR 409 STALE_EVENT",
    "ERROR 404 SHIPMENT_NOT_FOUND" or "ERROR 422 VALIDATION_ERROR" with the reason.
    """
    return _call("POST", f"/shipments/{shipment_id}/status-updates", json={"status": status, "occurredAt": occurred_at})


@read_tool()
def get_shipment_events(shipment_id: ShipmentId) -> str:
    """Get the history of status changes of a shipment, oldest first.

    Use this to see what happened to a shipment, or what Accounting and Storefront were told.

    Arguments:
    - shipment_id: format "S-" plus at least 4 digits, e.g. "S-2001". An order id like "O-1001" is wrong here.

    Returns JSON {"data": [events]}. Each event has shipmentId, orderId, carrierCode, trackingNumber,
    previousStatus, status, updatedAt, attemptCount. The list is empty if the shipment has not changed yet.
    """
    return _call("GET", f"/shipments/{shipment_id}/events")


@read_tool()
def list_shipping_methods() -> str:
    """List the shipping methods a customer can choose at checkout (added in contract 1.2.0).

    Use this when someone asks which delivery options exist, what they cost or how long they take,
    or before create_shipment when you need a valid shipping_method. It takes no arguments.

    Returns JSON {"data": [methods]}. Each method has code ("STANDARD" or "EXPRESS", the value for
    create_shipment's shipping_method), carrierCode (e.g. "DHL"), name, description,
    estimatedDeliveryDays {"min", "max"} and price {"amountMinor", "currency"}, where amountMinor is
    in cents, e.g. 499 means 4.99 EUR.
    """
    return _call("GET", "/shipping/methods")


if __name__ == "__main__":
    mcp.run()  # the --read-only flag is read above; FastMCP ignores extra argv
