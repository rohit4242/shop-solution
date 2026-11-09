"""Unit tests for the MCP server. No running API needed: HTTP is mocked."""

import asyncio
import json

import httpx
import pytest
import yaml

import server

TOOL_PATHS = {
    "search": "/api/v1/search",
    "facets": "/api/v1/search/facets",
    "autocomplete": "/api/v1/search/autocomplete",
    "similar": "/api/v1/recommendations/similar",
    "also_bought": "/api/v1/recommendations/also-bought",
}
SPEC = yaml.safe_load(server.OPENAPI_FILE.read_text(encoding="utf-8"))
TOOLS = {tool.name: tool for tool in asyncio.run(server.mcp.list_tools())}


def enums(schema: dict) -> set:
    """All enum values anywhere in a JSON schema (handles anyOf for optional fields)."""
    found = set(schema.get("enum", []))
    for option in schema.get("anyOf", []):
        found |= enums(option)
    return found


def test_offers_exactly_the_five_tools():
    assert set(TOOLS) == set(TOOL_PATHS)


@pytest.mark.parametrize("name,path", TOOL_PATHS.items())
def test_tool_parameters_match_the_openapi_contract(name, path):
    contract = {p["name"]: p for p in SPEC["paths"][path]["get"]["parameters"]}
    schema = TOOLS[name].input_schema
    assert set(schema["properties"]) == set(contract)
    required = {n for n, p in contract.items() if p.get("required")}
    assert required <= set(schema.get("required", []))
    for parameter_name, parameter in contract.items():
        if "enum" in parameter["schema"]:
            assert enums(schema["properties"][parameter_name]) == set(parameter["schema"]["enum"])


@pytest.mark.parametrize("name", TOOL_PATHS)
def test_every_tool_and_parameter_is_described(name):
    tool = TOOLS[name]
    assert len(tool.description) > 80
    for parameter in tool.input_schema["properties"].values():
        assert parameter.get("description")


def mock_api(monkeypatch, handler):
    requests = []

    def record(request):
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(server, "TRANSPORT", httpx.MockTransport(record))
    return requests


def test_success_returns_only_the_data(monkeypatch):
    requests = mock_api(monkeypatch, lambda r: httpx.Response(200, json={"data": {"items": [], "total": 0}}))
    text = server.search(q="wireless", maxPriceMinor=2500)
    assert json.loads(text) == {"items": [], "total": 0}
    assert requests[0].url.path == "/api/v1/search"
    assert requests[0].url.params["maxPriceMinor"] == "2500"
    assert "category" not in requests[0].url.params  # omitted filters are not sent


def test_api_error_comes_back_as_text(monkeypatch):
    body = {"error": {"code": "PRODUCT_NOT_FOUND", "message": "Product not found."}}
    requests = mock_api(monkeypatch, lambda r: httpx.Response(404, json=body))
    text = server.similar(productId="a & b")
    assert text == "ERROR 404 PRODUCT_NOT_FOUND: Product not found."
    assert requests[0].url.params["productId"] == "a & b"


def test_connection_error_comes_back_as_text(monkeypatch):
    def fail(request):
        raise httpx.ConnectError("secret detail", request=request)

    mock_api(monkeypatch, fail)
    text = server.also_bought(productId="prd_1")
    assert text.startswith("ERROR: could not reach the Search API")
    assert "secret detail" not in text


def test_openapi_resource_is_the_contract():
    assert server.openapi_spec().startswith("openapi: 3.1")
