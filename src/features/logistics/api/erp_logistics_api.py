"""Logistics API. Contract first: openapi.yaml is loaded and served as this API's own documentation.

Start:  uvicorn erp_logistics_api:app --port 8000
Data lives in memory and is lost on restart.
"""

import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import yaml
from fastapi import FastAPI, Path as PathParam, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

import shipment_rules as rules

SPEC = yaml.safe_load((Path(__file__).parent / "openapi.yaml").read_text(encoding="utf-8"))

ShipmentStatus = Literal[
    "CREATED", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY",
    "DELIVERED", "DELIVERY_FAILED", "RETURNED", "CANCELLED",
]
ShipmentIdPath = PathParam(pattern=r"^S-[0-9]{4,}$", description="Shipment id, e.g. S-2001")


class Address(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipientName: str = Field(min_length=1)
    street: str = Field(min_length=1)
    postalCode: str = Field(min_length=1)
    city: str = Field(min_length=1)
    country: str = Field(pattern=r"^[A-Z]{2}$")


class OrderReadyForShipping(BaseModel):
    model_config = ConfigDict(extra="forbid")
    orderId: str = Field(pattern=r"^(O|M|ORD)-[0-9]+$")  # ORD- accepted since 1.3.0
    customerId: str = Field(min_length=1)
    paymentStatus: Literal["PAID"]
    shippingAddress: Address
    shippingMethod: Literal["STANDARD", "EXPRESS"]
    paymentReference: str | None = Field(None, min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")  # added in 1.1.0


class CarrierStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: ShipmentStatus
    occurredAt: str = Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$")  # the rules also reject impossible dates


class ApiError(Exception):
    def __init__(self, http_status: int, code: str, message: str):
        self.http_status, self.code, self.message = http_status, code, message


class Store:
    def __init__(self):
        self.shipments: dict[str, rules.Shipment] = {}
        self.events: dict[str, list[dict]] = {}
        self.payment_references: dict[str, str] = {}  # added in 1.1.0
        self.next_number = 2001


STORE = Store()
LOCK = threading.Lock()  # endpoints run in a thread pool; creates and updates must not interleave


def reset_store() -> None:
    global STORE
    STORE = Store()


def now() -> str:
    t = datetime.now(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def to_contract(s: rules.Shipment) -> dict:
    result = {
        "shipmentId": s.shipment_id,
        "orderId": s.order_id,
        "customerId": s.customer_id,
        "carrierCode": s.carrier_code,
        "trackingNumber": s.tracking_number,
        "shippingMethod": s.shipping_method,
        "status": s.status,
        "updatedAt": s.updated_at,
        "failedAttempts": s.failed_attempts,
    }
    reference = STORE.payment_references.get(s.shipment_id)
    if reference is not None:
        result["paymentReference"] = reference
    return result


def find(shipment_id: str) -> rules.Shipment:
    shipment = STORE.shipments.get(shipment_id)
    if shipment is None:
        raise ApiError(404, "SHIPMENT_NOT_FOUND", f"No shipment with id {shipment_id}")
    return shipment


app = FastAPI(title=SPEC["info"]["title"], version=SPEC["info"]["version"])
app.openapi = lambda: SPEC


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    query = f"?{request.url.query}" if request.url.query else ""
    print(f"[logistics-api] {request.method} {request.url.path}{query} -> {response.status_code}", flush=True)
    return response


def error_response(http_status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=http_status, content={"error": {"code": code, "message": message}})


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, exc: ApiError):
    return error_response(exc.http_status, exc.code, exc.message)


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(_: Request, exc: StarletteHTTPException):
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
    return error_response(exc.status_code, code, str(exc.detail))


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception):
    print(f"[logistics-api] unexpected error: {type(exc).__name__}: {exc}", flush=True)
    return error_response(500, "INTERNAL_ERROR", "Unexpected error in the Logistics API")


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    where = ".".join(str(part) for part in first["loc"])
    return error_response(422, "VALIDATION_ERROR", f"{where}: {first['msg']}")


@app.get("/shipping/methods")
def list_shipping_methods(request: Request):
    """Added in 1.2.0: delivery options for Storefront's checkout."""
    if request.query_params:
        raise ApiError(422, "VALIDATION_ERROR", "listShippingMethods takes no query parameters")
    return {"data": [dict(method) for method in rules.SHIPPING_METHODS]}


@app.post("/shipments", status_code=201)
def create_shipment(order: OrderReadyForShipping):
    with LOCK:
        if any(s.order_id == order.orderId for s in STORE.shipments.values()):
            raise ApiError(409, "ORDER_ALREADY_HAS_SHIPMENT", f"Order {order.orderId} already has a shipment")
        shipment_id = f"S-{STORE.next_number}"
        STORE.next_number += 1
        shipment = rules.create_shipment(shipment_id, order.orderId, order.customerId, order.shippingMethod, now())
        STORE.shipments[shipment_id] = shipment
        STORE.events[shipment_id] = []
        if order.paymentReference is not None:
            STORE.payment_references[shipment_id] = order.paymentReference
        return to_contract(shipment)


@app.get("/shipments")
def list_shipments(
    orderId: str | None = Query(None, pattern=r"^(O|M|ORD)-[0-9]+$"),
    customerId: str | None = Query(None, min_length=1),
    status: ShipmentStatus | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    matching = [
        s for s in STORE.shipments.values()
        if (orderId is None or s.order_id == orderId)
        and (customerId is None or s.customer_id == customerId)
        and (status is None or s.status == status)
    ]
    start = (page - 1) * pageSize
    return {
        "data": [to_contract(s) for s in matching[start:start + pageSize]],
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "totalItems": len(matching),
            "totalPages": math.ceil(len(matching) / pageSize),
        },
    }


@app.get("/shipments/{shipmentId}")
def get_shipment(shipmentId: str = ShipmentIdPath):
    return to_contract(find(shipmentId))


@app.post("/shipments/{shipmentId}/status-updates")
def apply_status_update(update: CarrierStatusUpdate, shipmentId: str = ShipmentIdPath):
    with LOCK:
        shipment = find(shipmentId)
        try:
            result = rules.apply_status_update(shipment, update.status, update.occurredAt)
        except rules.InvalidTransitionError as e:
            raise ApiError(409, "INVALID_TRANSITION", str(e))
        except rules.StaleEventError as e:
            raise ApiError(409, "STALE_EVENT", str(e))
        except rules.InvalidTimestampError as e:
            raise ApiError(422, "VALIDATION_ERROR", str(e))
        STORE.shipments[shipmentId] = result.shipment
        STORE.events[shipmentId].extend(result.events)
        return {"shipment": to_contract(result.shipment), "events": result.events}


@app.get("/shipments/{shipmentId}/events")
def get_shipment_events(shipmentId: str = ShipmentIdPath):
    find(shipmentId)
    return {"data": STORE.events[shipmentId]}
