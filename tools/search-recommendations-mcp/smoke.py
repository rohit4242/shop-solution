"""Scripted check of the MCP server against a running API. No model involved.

Start the API first (pnpm dev), then:  python smoke.py
It calls every tool once over stdio, plus the two error cases, and prints one
JSON line per call. Use it to check the wiring, not to judge an agent.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters

CALLS = [
    ("search", {"q": "wireless", "availability": "in_stock", "maxPriceMinor": 2500}),
    ("facets", {"q": "wireless"}),
    ("autocomplete", {"q": "wire"}),
    ("similar", {"productId": "prd_1"}),
    ("also_bought", {"productId": "prd_1"}),
    ("similar", {"productId": "prd_missing"}),  # expect a 404 as text
    ("also_bought", {"productId": "prd_5"}),  # expect an empty list, no substitutes
]


async def main() -> None:
    server = StdioServerParameters(
        command=sys.executable,
        args=[str(Path(__file__).with_name("server.py"))],
        env=dict(os.environ),
    )
    async with Client(server) as client:
        names = sorted(tool.name for tool in (await client.list_tools()).tools)
        assert names == ["also_bought", "autocomplete", "facets", "search", "similar"], names
        resource = await client.read_resource("erp://search-recommendations/openapi")
        assert "openapi: 3.1" in resource.contents[0].text
        print(json.dumps({"tools": names, "resource": "ok"}))

        for name, arguments in CALLS:
            text = (await client.call_tool(name, arguments)).content[0].text
            print(json.dumps({"tool": name, "arguments": arguments, "result": text}, ensure_ascii=False))
            if arguments.get("productId") == "prd_missing":
                assert text.startswith("ERROR 404 PRODUCT_NOT_FOUND"), text
            elif arguments.get("productId") == "prd_5":
                assert json.loads(text)["items"] == [], text
            else:
                assert not text.startswith("ERROR"), text
            if name == "search":
                assert json.loads(text)["items"][0]["productId"] == "prd_1", text


if __name__ == "__main__":
    asyncio.run(main())
