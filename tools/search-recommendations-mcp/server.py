"""MCP server for the Search & Recommendations API.

Each tool sends exactly one GET request to our API and returns the answer as
text. There are no business rules here: the API validates every input and does
all the searching and ranking. Errors also come back as text, so the model can
read them.

Start it in the MCP Inspector:  mcp dev server.py
"""

import json
import logging
import os
from pathlib import Path
from typing import Annotated, Literal

import httpx
from mcp.server import MCPServer
from pydantic import Field

API_BASE_URL = os.environ.get("SEARCH_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
OPENAPI_FILE = Path(__file__).resolve().parents[2] / "docs" / "search-recommendations" / "openapi.yaml"
TRANSPORT: httpx.BaseTransport | None = None  # tests replace this with a mock
logging.getLogger("httpx").setLevel(logging.WARNING)  # the API terminal already logs each request

# Closed sets become enums in the tool schema.
Availability = Literal["in_stock", "out_of_stock"]
Sort = Literal["relevance", "price_asc", "price_desc", "name_asc"]

mcp = MCPServer("shop-search-recommendations")


def call_api(path: str, params: dict) -> str:
    """Send one GET request to the API and return the result as text for the model."""
    query = {key: value for key, value in params.items() if value is not None}
    try:
        with httpx.Client(base_url=API_BASE_URL, timeout=10, transport=TRANSPORT) as client:
            response = client.get(path, params=query)
    except httpx.TimeoutException:
        return "ERROR: the Search API did not answer within 10 seconds."
    except httpx.RequestError:
        return f"ERROR: could not reach the Search API at {API_BASE_URL}. Is it running?"

    try:
        body = response.json()
    except ValueError:
        return f"ERROR {response.status_code}: the Search API did not return JSON."
    if response.is_success:
        return json.dumps(body["data"], ensure_ascii=False)
    error = body.get("error", {})
    return f"ERROR {response.status_code} {error.get('code', 'UNKNOWN')}: {error.get('message', '')}"


# Parameter names match the OpenAPI query parameters exactly (camelCase).
Query = Annotated[
    str,
    Field(description='Search words, e.g. "wireless mouse". Up to 200 characters. Empty string lists all products.'),
]
Category = Annotated[str | None, Field(description='Exact category name, e.g. "Electronics". Omit for all categories.')]
SellerId = Annotated[str | None, Field(description='Exact seller ID, e.g. "sel_2". Omit for all sellers.')]
AvailabilityFilter = Annotated[
    Availability | None,
    Field(description="Only products in stock or out of stock. Omit to include both."),
]
MinPrice = Annotated[int | None, Field(description="Lowest price in euro cents, inclusive. 1000 means €10.")]
MaxPrice = Annotated[int | None, Field(description="Highest price in euro cents, inclusive. 2500 means €25.")]
ProductId = Annotated[
    str,
    Field(description='Product ID, e.g. "prd_1", given by the user or taken from a search result. Pass it unchanged.'),
]


@mcp.tool()
def search(
    q: Query = "",
    category: Category = None,
    sellerId: SellerId = None,
    availability: AvailabilityFilter = None,
    minPriceMinor: MinPrice = None,
    maxPriceMinor: MaxPrice = None,
    sort: Annotated[Sort, Field(description="Result order. Default: relevance.")] = "relevance",
    page: Annotated[int, Field(description="Page number, starting at 1.")] = 1,
    pageSize: Annotated[int, Field(description="Products per page, 1 to 100.")] = 20,
) -> str:
    """Find products in the shop catalog by words and filters.

    Use this first whenever the user asks for products, e.g. "in-stock wireless
    products under €25" becomes q="wireless", availability="in_stock",
    maxPriceMinor=2500. All prices are euro cents. Out-of-stock products are
    included unless you filter them out.

    Returns JSON with "items" (each with productId, offerId, sellerId, name,
    category, priceMinor, currency, availability), "total", "page" and
    "pageSize". Use productId from the items for similar or also_bought.
    An empty items list means nothing matched; that is a valid answer.
    """
    return call_api(
        "/api/v1/search",
        {
            "q": q,
            "category": category,
            "sellerId": sellerId,
            "availability": availability,
            "minPriceMinor": minPriceMinor,
            "maxPriceMinor": maxPriceMinor,
            "sort": sort,
            "page": page,
            "pageSize": pageSize,
        },
    )


@mcp.tool()
def facets(
    q: Query = "",
    category: Category = None,
    sellerId: SellerId = None,
    availability: AvailabilityFilter = None,
    minPriceMinor: MinPrice = None,
    maxPriceMinor: MaxPrice = None,
) -> str:
    """Count the products per category, seller and stock state for a search.

    Use this to learn which categories or sellers exist, or how many products
    match before searching, e.g. q="wireless" to see which categories have
    wireless products. Takes the same filters as search, without sorting or pages.

    Returns JSON with "categories" and "sellers" (each value with a count),
    "availability" counts, and "priceRange" with the lowest and highest price
    in euro cents (null when nothing matches).
    """
    return call_api(
        "/api/v1/search/facets",
        {
            "q": q,
            "category": category,
            "sellerId": sellerId,
            "availability": availability,
            "minPriceMinor": minPriceMinor,
            "maxPriceMinor": maxPriceMinor,
        },
    )


@mcp.tool()
def autocomplete(
    q: Annotated[str, Field(description='The start of a product name, at least 2 characters, e.g. "wire".')],
    category: Category = None,
    availability: AvailabilityFilter = None,
    limit: Annotated[int, Field(description="Maximum number of suggestions, 1 to 10.")] = 5,
) -> str:
    """Suggest product names that start with the letters the user typed.

    Use this when the user gives only part of a product name, or to turn a
    name into a productId, e.g. q="wire" suggests "Wireless Mouse".

    Returns JSON with "suggestions", each with productId and name. An empty
    list means no product name starts with those letters.
    """
    return call_api(
        "/api/v1/search/autocomplete",
        {"q": q, "category": category, "availability": availability, "limit": limit},
    )


@mcp.tool()
def similar(
    productId: ProductId,
    availability: AvailabilityFilter = None,
    limit: Annotated[int, Field(description="Maximum number of products, 1 to 20.")] = 5,
) -> str:
    """Find alternatives to one product: products from the same category with
    similar attributes and price.

    Use this when the user asks for alternatives or "something like" a product.
    If the user gives a productId, call this tool with it directly: only the
    API knows which IDs exist, so never say a product is missing without
    calling it. If you only have a name, call search first to get the ID.
    This is not purchase data; use also_bought for that.

    Returns JSON with "items", best match first, never including the product
    itself. "ERROR 404 PRODUCT_NOT_FOUND" means the productId does not exist;
    tell the user instead of guessing.
    """
    return call_api(
        "/api/v1/recommendations/similar",
        {"productId": productId, "availability": availability, "limit": limit},
    )


@mcp.tool()
def also_bought(
    productId: ProductId,
    availability: AvailabilityFilter = None,
    limit: Annotated[int, Field(description="Maximum number of products, 1 to 20.")] = 5,
) -> str:
    """Find products that were bought together with one product.

    Use this when the user asks what other customers bought with a product.
    Call it directly with a productId the user gives; if you only have a
    name, call search first. The purchase data is a small synthetic
    sample, not real customer behaviour.

    Returns JSON with "items", most often bought together first. An empty
    items list means there is no purchase data for this product: say so, and
    do not replace it with similar products. "ERROR 404 PRODUCT_NOT_FOUND"
    means the productId does not exist.
    """
    return call_api(
        "/api/v1/recommendations/also-bought",
        {"productId": productId, "availability": availability, "limit": limit},
    )


@mcp.resource("erp://search-recommendations/openapi", mime_type="application/yaml")
def openapi_spec() -> str:
    """The OpenAPI 3.1 contract of the Search & Recommendations API."""
    return OPENAPI_FILE.read_text(encoding="utf-8")


if __name__ == "__main__":
    mcp.run(transport="stdio")
