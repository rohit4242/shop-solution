"""MCP server tests. The real mcp_server.py is started as a subprocess over stdio and talks to a live API."""

import asyncio
import json
import os
import socket
import sys
import threading
import time
from pathlib import Path

import pytest
import uvicorn
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

import erp_logistics_api as api

API_DIR = Path(__file__).parent.parent


def attr(obj, camel, snake):
    """MCP SDK 1.x uses camelCase attribute names, 2.x uses snake_case."""
    return getattr(obj, camel) if hasattr(obj, camel) else getattr(obj, snake)


def is_error(result):
    return attr(result, "isError", "is_error")



@pytest.fixture(scope="module")
def live_api():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    server = uvicorn.Server(uvicorn.Config(api.app, host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 15
    while not server.started:
        assert time.time() < deadline, "API did not start"
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(10)


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    monkeypatch.setattr(api, "now", lambda: "2026-11-01T00:00:00.000Z")  # tests use fixed 2026-11-10 timestamps
    api.reset_store()


def run(base_url, work):
    async def session_work():
        params = StdioServerParameters(
            command=sys.executable,
            args=[str(API_DIR / "mcp_server.py")],
            env={**os.environ, "LOGISTICS_API_BASE_URL": base_url},
            cwd=str(API_DIR),
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await work(session)

    return asyncio.run(session_work())


def text_of(result) -> str:
    return result.content[0].text


ORDER_ARGS = {
    "order_id": "O-1001",
    "customer_id": "C-501",
    "payment_status": "PAID",
    "recipient_name": "Erika Mustermann",
    "street": "Hauptstrasse 1",
    "postal_code": "94469",
    "city": "Deggendorf",
    "country": "DE",
    "shipping_method": "STANDARD",
}


def test_server_offers_five_tools_with_enums_in_the_schema_and_model_oriented_descriptions(live_api):
    async def work(session):
        return (await session.list_tools()).tools

    tools = {t.name: t for t in run(live_api, work)}
    assert set(tools) == {"create_shipment", "get_shipment", "list_shipments", "apply_status_update", "get_shipment_events", "list_shipping_methods"}
    for tool in tools.values():
        assert len(tool.description) > 150, tool.name
        assert "e.g." in tool.description or "Example" in tool.description, tool.name
    update_schema = json.dumps(attr(tools["apply_status_update"], "inputSchema", "input_schema"))
    for status in ("CREATED", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNED", "CANCELLED"):
        assert f'"{status}"' in update_schema
    create_schema = json.dumps(attr(tools["create_shipment"], "inputSchema", "input_schema"))
    assert '"EXPRESS"' in create_schema and '"PAID"' in create_schema


def test_openapi_yaml_is_offered_as_a_resource_and_equals_the_file(live_api):
    async def work(session):
        listed = (await session.list_resources()).resources
        read = await session.read_resource("openapi://logistics")
        return listed, read

    listed, read = run(live_api, work)
    assert [str(r.uri) for r in listed] == ["openapi://logistics"]
    assert read.contents[0].text == (API_DIR / "openapi.yaml").read_text(encoding="utf-8")


def test_tools_reach_the_api_and_a_multi_step_task_works(live_api):
    async def work(session):
        created = json.loads(text_of(await session.call_tool("create_shipment", ORDER_ARGS)))
        found = json.loads(text_of(await session.call_tool("list_shipments", {"order_id": "O-1001"})))
        updated = json.loads(text_of(await session.call_tool(
            "apply_status_update",
            {"shipment_id": created["shipmentId"], "status": "LABEL_CREATED", "occurred_at": "2026-11-10T09:00:00.000Z"},
        )))
        events = json.loads(text_of(await session.call_tool("get_shipment_events", {"shipment_id": created["shipmentId"]})))
        return created, found, updated, events

    created, found, updated, events = run(live_api, work)
    assert created["status"] == "CREATED" and created["orderId"] == "O-1001"
    assert [s["shipmentId"] for s in found["data"]] == [created["shipmentId"]]
    assert updated["shipment"]["status"] == "LABEL_CREATED"
    assert [e["status"] for e in events["data"]] == ["LABEL_CREATED"]
    # downstream value: the shipment really is in the API's store, not just echoed back
    assert api.STORE.shipments[created["shipmentId"]].status == "LABEL_CREATED"


def test_api_errors_come_back_as_readable_text_not_exceptions(live_api):
    async def work(session):
        missing = await session.call_tool("get_shipment", {"shipment_id": "S-9999"})
        created = json.loads(text_of(await session.call_tool("create_shipment", ORDER_ARGS)))
        forbidden = await session.call_tool(
            "apply_status_update",
            {"shipment_id": created["shipmentId"], "status": "DELIVERED", "occurred_at": "2026-11-10T09:00:00.000Z"},
        )
        return missing, forbidden

    missing, forbidden = run(live_api, work)
    assert not is_error(missing) and text_of(missing).startswith("ERROR 404 SHIPMENT_NOT_FOUND")
    assert not is_error(forbidden) and text_of(forbidden).startswith("ERROR 409 INVALID_TRANSITION")


def test_an_enum_violation_is_rejected_before_it_reaches_the_api(live_api):
    async def work(session):
        return await session.call_tool("create_shipment", {**ORDER_ARGS, "shipping_method": "standard"})

    assert is_error(run(live_api, work))
    assert api.STORE.shipments == {}


def test_a_shipment_id_cannot_smuggle_a_different_request_into_the_url(live_api):
    async def work(session):
        created = json.loads(text_of(await session.call_tool("create_shipment", ORDER_ARGS)))
        return created, await session.call_tool("get_shipment", {"shipment_id": f"{created['shipmentId']}/events"})

    _, smuggled = run(live_api, work)
    assert is_error(smuggled)  # rejected by the tool schema before any request is sent; no events list comes back


def test_unreachable_api_is_reported_as_text():
    async def work(session):
        return await session.call_tool("get_shipment", {"shipment_id": "S-2001"})

    result = run("http://127.0.0.1:1", work)
    assert not is_error(result) and text_of(result).startswith("ERROR: cannot reach the Logistics API")
