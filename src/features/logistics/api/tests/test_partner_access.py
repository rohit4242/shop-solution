import runpy
import sys

from fastapi.testclient import TestClient


def test_accounting_creates_and_storefront_reads_the_same_shipment(monkeypatch):
    monkeypatch.setenv("LOGISTICS_API_TOKEN", "internal-test-token")
    monkeypatch.setenv("LOGISTICS_ACCOUNTING_TOKEN", "accounting-test-token")
    monkeypatch.setenv("LOGISTICS_STOREFRONT_TOKEN", "storefront-test-token")
    # The adapter installs middleware on the API. Give it its own module instance.
    monkeypatch.delitem(sys.modules, "erp_logistics_api", raising=False)
    app = runpy.run_module("demo_api")["app"]
    accounting = {"Authorization": "Bearer accounting-test-token"}
    storefront = {"Authorization": "Bearer storefront-test-token"}
    order = {
        "orderId": "O-3001",
        "customerId": "C-501",
        "paymentStatus": "PAID",
        "shippingMethod": "STANDARD",
        "shippingAddress": {
            "recipientName": "Demo Customer",
            "street": "Example Street 1",
            "postalCode": "94469",
            "city": "Deggendorf",
            "country": "DE",
        },
    }

    with TestClient(app) as client:
        assert client.get("/shipments", headers=accounting).status_code == 403
        assert client.get("/shipments", headers=storefront).status_code == 403
        assert client.post("/shipments", headers=storefront, json=order).status_code == 403
        assert client.post("/shipments", json=order).status_code == 401
        created = client.post("/shipments", headers=accounting, json=order)
        assert created.status_code == 201
        assert client.post("/shipments", headers=accounting, json=order).status_code == 409

        result = client.get("/shipments?orderId=O-3001", headers=storefront)
        assert result.status_code == 200
        shipment = result.json()["data"][0]
        shipment_path = f"/shipments/{shipment['shipmentId']}"
        assert shipment["status"] == "CREATED"
        assert client.get(shipment_path + "/events", headers=storefront).json() == {"data": []}
        assert client.post(shipment_path + "/status-updates", headers=storefront).status_code == 403


def test_shipping_methods_are_public_for_storefront_checkout(monkeypatch):
    monkeypatch.setenv("LOGISTICS_API_TOKEN", "internal-test-token")
    monkeypatch.setenv("LOGISTICS_ACCOUNTING_TOKEN", "accounting-test-token")
    monkeypatch.setenv("LOGISTICS_STOREFRONT_TOKEN", "storefront-test-token")
    monkeypatch.delitem(sys.modules, "erp_logistics_api", raising=False)
    app = runpy.run_module("demo_api")["app"]
    with TestClient(app) as client:
        assert client.get("/shipping/methods", headers={"Authorization": "Bearer storefront-test-token"}).status_code == 200
        assert client.get("/shipping/methods").status_code == 200
        assert client.post("/shipping/methods").status_code == 405
