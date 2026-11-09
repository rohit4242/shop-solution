"""Stage 4 agent for our module: the model gets all its tools from our MCP server.

Same loop as the lecture's stage 4:
  1. tools/list  - ask the MCP server what it offers
  2. pass the tool names, descriptions and schemas to the model unchanged
  3. tools/call  - run each tool the model picks, feed the result back

Usage:
    python agent.py "Find in-stock wireless products under €25."

Environment: OPENAI_API_KEY and OPENAI_MODEL (required), OPENAI_BASE_URL
(optional; any OpenAI-compatible provider, defaults to OpenAI),
SEARCH_API_BASE_URL (passed to the server).
Run the API first (pnpm dev) and keep its terminal next to this one.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters
from openai import AsyncOpenAI

SERVER = "server.py"
MAX_STEPS = 10
SYSTEM_PROMPT = (
    "You help people find products in an online shop. Use the tools for every "
    "claim about products, prices or recommendations. Prices are euro cents. "
    "If a tool returns an error or an empty list, say so plainly; never invent "
    "products or recommendations."
)


def to_openai_tool(tool) -> dict:
    """Turn an MCP tool definition into the OpenAI function-calling format."""
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description or "",
            "parameters": tool.input_schema,
        },
    }


def result_text(result) -> str:
    return "\n".join(part.text for part in result.content if getattr(part, "text", None) is not None)


def shorten(text: str, limit: int = 160) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


async def run(task: str) -> None:
    model_name = os.environ["OPENAI_MODEL"]
    model = AsyncOpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ.get("OPENAI_BASE_URL") or None,  # None = OpenAI
    )
    server = StdioServerParameters(
        command=sys.executable,
        args=[str(Path(__file__).with_name(SERVER))],
        env=dict(os.environ),
    )

    async with Client(server) as session:
        mcp_tools = (await session.list_tools()).tools  # 1. tools/list
        tools = [to_openai_tool(t) for t in mcp_tools]  # 2. pass to the model
        print(f"Model: {model_name} · Tools: {', '.join(t.name for t in mcp_tools)}\n")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task},
        ]
        calls = 0
        for _ in range(MAX_STEPS):
            response = await model.chat.completions.create(model=model_name, messages=messages, tools=tools)
            message = response.choices[0].message
            messages.append(message.model_dump(exclude_none=True))

            if not message.tool_calls:
                print(f"\n{message.content}")
                return

            for call in message.tool_calls:
                calls += 1
                print(f"[{calls}] {call.function.name}({call.function.arguments})")
                try:
                    arguments = json.loads(call.function.arguments or "{}")
                    result = await session.call_tool(call.function.name, arguments)  # 3. tools/call
                    text = result_text(result)
                except Exception as error:  # report to the model instead of crashing
                    text = f"ERROR: the tool call failed ({type(error).__name__})."
                print(f"    -> {shorten(text)}")
                messages.append({"role": "tool", "tool_call_id": call.id, "content": text})

        print(f"\nStopped after {MAX_STEPS} steps without a final answer.")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    missing = [name for name in ("OPENAI_API_KEY", "OPENAI_MODEL") if not os.environ.get(name)]
    if missing:
        raise SystemExit(f"Set {' and '.join(missing)} first. Never commit your API key.")
    sys.stdout.reconfigure(errors="replace")
    asyncio.run(run(sys.argv[1]))


if __name__ == "__main__":
    main()
