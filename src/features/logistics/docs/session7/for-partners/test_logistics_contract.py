"""Contract test for Storefront and Accounting: checks the REAL Logistics API against the Logistics contract.

Copy this file into your own tests. It needs a running Logistics API and the Logistics openapi.yaml:

    LOGISTICS_OPENAPI=src/features/logistics/api/openapi.yaml
    LOGISTICS_BASE_URL=http://localhost:8000
    pip install pyyaml pytest && pytest test_logistics_contract.py -q

It creates one shipment for a test order, then reads it the way the flow does.
Run it against the plain local API (uvicorn erp_logistics_api:app). The token-protected
demo_api:app splits these calls between the Accounting and Storefront tokens.
"""

import json
import os
import random
import urllib.error
import urllib.request

import yaml

SPEC = yaml.safe_load(open(os.environ.get("LOGISTICS_OPENAPI", "src/features/logistics/api/openapi.yaml"), encoding="utf-8"))
BASE = os.environ.get("LOGISTICS_BASE_URL", "http://localhost:8000").rstrip("/")
REQUIRED = set(SPEC["components"]["schemas"]["Shipment"]["required"])


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def paid_order():
    return {
        "orderId": f"O-{random.randint(100000, 999999)}",
        "customerId": "C-1",
        "paymentStatus": "PAID",
        "shippingAddress": {"recipientName": "Max Mustermann", "street": "Musterstrasse 1",
                            "postalCode": "94469", "city": "Deggendorf", "country": "DE"},
        "shippingMethod": "STANDARD",
        "paymentReference": "PAY-1",
    }


def test_create_shipment_returns_all_contract_fields():
    status, shipment = call("POST", "/shipments", paid_order())
    assert status == 201, shipment
    missing = REQUIRED - shipment.keys()
    assert not missing, f"fields missing from the Logistics contract: {missing}"
    assert shipment["status"] == "CREATED"


def test_storefront_finds_the_shipment_by_order_id():
    order = paid_order()
    _, created = call("POST", "/shipments", order)
    status, page = call("GET", f"/shipments?orderId={order['orderId']}")
    assert status == 200
    assert [s["shipmentId"] for s in page["data"]] == [created["shipmentId"]]
    assert not REQUIRED - page["data"][0].keys()


def test_second_create_for_the_same_order_is_409():
    order = paid_order()
    call("POST", "/shipments", order)
    status, body = call("POST", "/shipments", order)
    assert status == 409 and body["error"]["code"] == "ORDER_ALREADY_HAS_SHIPMENT"
