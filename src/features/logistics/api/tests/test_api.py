"""API tests. Every response body is validated against the schemas in openapi.yaml (contract conformance)."""

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

import erp_logistics_api as api

ORDER = {
    "orderId": "O-1001",
    "customerId": "C-501",
    "paymentStatus": "PAID",
    "shippingAddress": {
        "recipientName": "Erika Mustermann",
        "street": "Hauptstrasse 1",
        "postalCode": "94469",
        "city": "Deggendorf",
        "country": "DE",
    },
    "shippingMethod": "STANDARD",
}


def at(hour: int) -> str:
    return f"2026-11-10T{hour:02d}:00:00.000Z"


def conforms(body, schema_name: str) -> None:
    schema = {"$ref": f"#/components/schemas/{schema_name}", "components": api.SPEC["components"]}
    Draft202012Validator(schema).validate(body)


@pytest.fixture
def client(monkeypatch):
    # fixed creation time: the tests use 2026-11-10 timestamps and must not depend on the real clock
    monkeypatch.setattr(api, "now", lambda: "2026-11-01T00:00:00.000Z")
    api.reset_store()
    return TestClient(api.app)


def create(client, **changes):
    r = client.post("/shipments", json={**ORDER, **changes})
    return r


def update(client, shipment_id, status, hour):
    return client.post(f"/shipments/{shipment_id}/status-updates", json={"status": status, "occurredAt": at(hour)})


def advance_to_out_for_delivery(client, shipment_id="S-2001"):
    for hour, status in ((9, "LABEL_CREATED"), (10, "IN_TRANSIT"), (11, "OUT_FOR_DELIVERY")):
        assert update(client, shipment_id, status, hour).status_code == 200


# ---- the served documentation is the contract ----


def test_served_openapi_json_is_the_yaml_file_as_it_is_on_disk(client):
    import yaml
    from pathlib import Path

    on_disk = yaml.safe_load((Path(api.__file__).parent / "openapi.yaml").read_text(encoding="utf-8"))
    assert client.get("/openapi.json").json() == on_disk
    assert client.get("/docs").status_code == 200


def test_unknown_route_and_wrong_method_use_the_contract_error_shape(client):
    missing = client.get("/nothing-here")
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NOT_FOUND"
    conforms(missing.json(), "Error")
    wrong = client.delete("/shipments")
    assert wrong.status_code == 405 and wrong.json()["error"]["code"] == "METHOD_NOT_ALLOWED"
    conforms(wrong.json(), "Error")


def test_replaying_an_older_update_after_a_newer_one_is_a_200_with_no_events(client):
    create(client)
    update(client, "S-2001", "LABEL_CREATED", 9)
    update(client, "S-2001", "IN_TRANSIT", 10)
    r = update(client, "S-2001", "LABEL_CREATED", 9)
    assert r.status_code == 200 and r.json()["events"] == []
    assert len(client.get("/shipments/S-2001/events").json()["data"]) == 2


def test_contract_has_three_to_five_operations_each_with_a_documented_error_case():
    operations = [
        op for path in api.SPEC["paths"].values() for op in path.values()
    ]
    # Session 5 asked for 3 to 5 operations. Session 7 allows additions to an agreed contract
    # (1.2.0 adds listShippingMethods for Storefront), so only the lower bound still applies.
    assert len(operations) >= 3
    for op in operations:
        assert op["operationId"] and op["summary"] and op["description"]
        assert any(code.startswith("4") for code in op["responses"])


def test_contract_is_a_valid_openapi_31_document():
    from openapi_spec_validator import validate

    validate(api.SPEC)
    assert api.SPEC["openapi"].startswith("3.1")


# ---- createShipment ----


def test_create_shipment_returns_201_and_a_contract_conform_shipment(client):
    r = create(client)
    assert r.status_code == 201
    conforms(r.json(), "Shipment")
    body = r.json()
    assert body["shipmentId"] == "S-2001" and body["orderId"] == "O-1001"
    assert body["status"] == "CREATED" and body["carrierCode"] == "DHL" and body["failedAttempts"] == 0


def test_short_storefront_style_order_id_is_accepted(client):
    r = create(client, orderId="O-1", customerId="C-1")
    assert r.status_code == 201 and r.json()["orderId"] == "O-1" and r.json()["customerId"] == "C-1"
    assert client.get("/shipments?orderId=O-1").json()["pagination"]["totalItems"] == 1


def test_marketplace_sale_id_is_accepted_as_order_id(client):
    r = create(client, orderId="M-2001", customerId="C-9")
    assert r.status_code == 201 and r.json()["orderId"] == "M-2001"
    assert client.get("/shipments?orderId=M-2001").json()["pagination"]["totalItems"] == 1
    assert create(client, orderId="X-1").status_code == 422


def test_list_filters_by_customer(client):
    create(client)
    create(client, orderId="O-1002", customerId="C-777")
    create(client, orderId="O-1003")
    found = client.get("/shipments?customerId=C-501").json()
    conforms(found, "ShipmentList")
    assert [s["orderId"] for s in found["data"]] == ["O-1001", "O-1003"]
    assert client.get("/shipments?customerId=C-000").json()["data"] == []


def test_second_shipment_for_the_same_order_is_409(client):
    create(client)
    r = create(client)
    assert r.status_code == 409
    conforms(r.json(), "Error")
    assert r.json()["error"]["code"] == "ORDER_ALREADY_HAS_SHIPMENT"
    assert client.get("/shipments").json()["pagination"]["totalItems"] == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"paymentStatus": "PENDING"},
        {"orderId": "S-2001"},
        {"orderId": "1001"},
        {"shippingMethod": "express"},
        {"shippingAddress": {"recipientName": "x"}},
        {"shippingAddress": {**ORDER["shippingAddress"], "country": "Germany"}},
        {"unexpectedField": 1},
    ],
)
def test_invalid_order_is_422_with_the_contract_error_shape_and_nothing_is_stored(client, changes):
    r = create(client, **changes)
    assert r.status_code == 422
    conforms(r.json(), "Error")
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get("/shipments").json()["data"] == []


def test_missing_body_is_422_not_500(client):
    assert client.post("/shipments").status_code == 422


# ---- getShipment / listShipments ----


def test_get_unknown_shipment_is_404(client):
    r = client.get("/shipments/S-9999")
    assert r.status_code == 404
    conforms(r.json(), "Error")
    assert r.json()["error"]["code"] == "SHIPMENT_NOT_FOUND"


@pytest.mark.parametrize("bad_id", ["O-1001", "S-1", "2001", "s-2001"])
def test_get_with_a_malformed_id_is_422(client, bad_id):
    assert client.get(f"/shipments/{bad_id}").status_code == 422


def test_order_id_cannot_be_used_as_shipment_id(client):
    create(client)
    assert client.get("/shipments/O-1001").status_code == 422


def test_get_returns_what_was_created(client):
    create(client)
    r = client.get("/shipments/S-2001")
    assert r.status_code == 200
    conforms(r.json(), "Shipment")
    assert r.json()["orderId"] == "O-1001"


def test_list_filters_by_order_and_status_and_paginates(client):
    create(client)
    create(client, orderId="O-1002", shippingMethod="EXPRESS")
    create(client, orderId="O-1003")
    update(client, "S-2002", "LABEL_CREATED", 9)

    everything = client.get("/shipments").json()
    conforms(everything, "ShipmentList")
    assert [s["shipmentId"] for s in everything["data"]] == ["S-2001", "S-2002", "S-2003"]

    assert [s["shipmentId"] for s in client.get("/shipments?orderId=O-1003").json()["data"]] == ["S-2003"]
    assert [s["shipmentId"] for s in client.get("/shipments?status=LABEL_CREATED").json()["data"]] == ["S-2002"]

    page = client.get("/shipments?page=2&pageSize=2").json()
    assert [s["shipmentId"] for s in page["data"]] == ["S-2003"]
    assert page["pagination"] == {"page": 2, "pageSize": 2, "totalItems": 3, "totalPages": 2}


@pytest.mark.parametrize("query", ["status=SHIPPED", "orderId=S-2001", "page=0", "pageSize=101"])
def test_list_with_bad_filter_is_422(client, query):
    r = client.get(f"/shipments?{query}")
    assert r.status_code == 422
    conforms(r.json(), "Error")


# ---- applyStatusUpdate ----


def test_valid_update_returns_shipment_and_event_and_stores_them(client):
    create(client)
    r = update(client, "S-2001", "LABEL_CREATED", 9)
    assert r.status_code == 200
    conforms(r.json(), "StatusUpdateResult")
    assert r.json()["shipment"]["status"] == "LABEL_CREATED"
    assert [(e["previousStatus"], e["status"]) for e in r.json()["events"]] == [("CREATED", "LABEL_CREATED")]
    assert client.get("/shipments/S-2001").json()["status"] == "LABEL_CREATED"
    events = client.get("/shipments/S-2001/events").json()
    conforms(events, "ShipmentEventList")
    assert len(events["data"]) == 1


def test_forbidden_transition_is_409_and_changes_nothing(client):
    create(client)
    r = update(client, "S-2001", "DELIVERED", 9)
    assert r.status_code == 409
    conforms(r.json(), "Error")
    assert r.json()["error"]["code"] == "INVALID_TRANSITION"
    assert client.get("/shipments/S-2001").json()["status"] == "CREATED"
    assert client.get("/shipments/S-2001/events").json()["data"] == []


def test_stale_update_is_409_stale_event(client):
    create(client)
    update(client, "S-2001", "LABEL_CREATED", 9)
    r = update(client, "S-2001", "IN_TRANSIT", 8)
    assert r.status_code == 409 and r.json()["error"]["code"] == "STALE_EVENT"


def test_repeated_update_is_200_with_no_events_and_stores_no_duplicate(client):
    create(client)
    update(client, "S-2001", "LABEL_CREATED", 9)
    r = update(client, "S-2001", "LABEL_CREATED", 9)
    assert r.status_code == 200 and r.json()["events"] == []
    assert len(client.get("/shipments/S-2001/events").json()["data"]) == 1


@pytest.mark.parametrize("bad", ["2026-11-10 09:00", "2026-11-10T09:00:00Z", "nonsense"])
def test_non_utc_timestamp_is_422(client, bad):
    create(client)
    r = client.post("/shipments/S-2001/status-updates", json={"status": "LABEL_CREATED", "occurredAt": bad})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_bad_timestamp_is_422_even_for_an_unknown_shipment(client):
    r = client.post("/shipments/S-9999/status-updates", json={"status": "LABEL_CREATED", "occurredAt": "yesterday"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    impossible = client.post("/shipments/S-9999/status-updates", json={"status": "LABEL_CREATED", "occurredAt": "2026-13-45T09:00:00.000Z"})
    assert impossible.status_code == 404  # well-formed text, so the lookup comes first; the rules reject impossible dates later


def test_unknown_status_value_is_422(client):
    create(client)
    r = client.post("/shipments/S-2001/status-updates", json={"status": "SHIPPED", "occurredAt": at(9)})
    assert r.status_code == 422


def test_update_for_unknown_shipment_is_404(client):
    assert update(client, "S-9999", "LABEL_CREATED", 9).status_code == 404


def test_three_failed_deliveries_return_the_shipment_with_two_events_at_the_third(client):
    create(client)
    advance_to_out_for_delivery(client)
    r1 = update(client, "S-2001", "DELIVERY_FAILED", 12)
    assert r1.json()["shipment"]["failedAttempts"] == 1 and len(r1.json()["events"]) == 1
    update(client, "S-2001", "OUT_FOR_DELIVERY", 13)
    update(client, "S-2001", "DELIVERY_FAILED", 14)
    update(client, "S-2001", "IN_TRANSIT", 15)
    update(client, "S-2001", "OUT_FOR_DELIVERY", 16)
    r3 = update(client, "S-2001", "DELIVERY_FAILED", 17)
    conforms(r3.json(), "StatusUpdateResult")
    assert r3.json()["shipment"]["status"] == "RETURNED" and r3.json()["shipment"]["failedAttempts"] == 3
    assert [(e["previousStatus"], e["status"]) for e in r3.json()["events"]] == [
        ("OUT_FOR_DELIVERY", "DELIVERY_FAILED"),
        ("DELIVERY_FAILED", "RETURNED"),
    ]
    assert update(client, "S-2001", "OUT_FOR_DELIVERY", 18).status_code == 409


def test_events_endpoint_is_404_for_unknown_shipment(client):
    assert client.get("/shipments/S-9999/events").status_code == 404


# ---- request log ----


def test_every_request_is_logged_with_method_path_and_status(client, capsys):
    client.get("/shipments/S-9999")
    out = capsys.readouterr().out
    assert "[logistics-api] GET /shipments/S-9999 -> 404" in out
