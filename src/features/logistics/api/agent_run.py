"""Part 4: let a language model operate the Logistics API through the MCP server.

Start the API first (uvicorn erp_logistics_api:app --port 8000), then:  python agent_run.py
Environment:
  LLM_API_KEY      key for an OpenAI-compatible endpoint (falls back to CHAT_AI_API_KEY). Never write it into a file.
  LLM_BASE_URL     default https://chat-ai.academiccloud.de/v1
  LLM_MODEL        model name of that endpoint
  LOGISTICS_API_BASE_URL  address of the API (default http://localhost:8000), read by the MCP server
Options: --prompt "text" runs one prompt instead of the three default ones; --out FILE saves the transcript.
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import OpenAI

SERVER = Path(__file__).parent / "mcp_server.py"
MAX_STEPS = 8

SYSTEM = "You are an assistant for the Logistics module of a shop. Use the tools to do what the user asks."

PROMPTS = {
    "happy path": (
        "Order O-3001 of customer C-900 is paid. Ship it to Max Mustermann, Musterstrasse 1, 94469 Deggendorf, "
        "Germany, with EXPRESS delivery. Create the shipment and tell me its shipment id, carrier and tracking number."
    ),
    "error case": "What is the current status of shipment S-9999?",
    "several steps": (
        "For order O-3001: find its shipment (I do not know the shipment id), mark it LABEL_CREATED at "
        "2027-01-10T09:00:00.000Z and then IN_TRANSIT at 2027-01-10T10:00:00.000Z, and show me its event history."
    ),
    # extra prompt (beyond the three required): does the model report a refused step, or invent a workaround?
    "forbidden step (extra)": (
        "The parcel of order O-3001 has just been delivered to the customer. Mark its shipment DELIVERED "
        "at 2027-01-10T11:00:00.000Z."
    ),
}


def attr(obj, camel: str, snake: str):
    """MCP SDK 1.x names this attribute in camelCase, SDK 2.x in snake_case."""
    return getattr(obj, camel) if hasattr(obj, camel) else getattr(obj, snake)


def clip(text: str, n: int = 700) -> str:
    return text if len(text) <= n else text[:n] + " ...[cut]"


async def run_prompt(session: ClientSession, client: OpenAI, model: str, tools: list, prompt: str, log) -> None:
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]
    log(f"USER: {prompt}")
    for _ in range(MAX_STEPS):
        reply = client.chat.completions.create(model=model, messages=messages, tools=tools, temperature=0)
        message = reply.choices[0].message
        messages.append(message.model_dump(exclude_none=True))
        if not message.tool_calls:
            log(f"ANSWER: {message.content}")
            return
        for call in message.tool_calls:
            args = json.loads(call.function.arguments or "{}")
            log(f"TOOL CALL: {call.function.name}({json.dumps(args)})")
            result = await session.call_tool(call.function.name, args)
            text = result.content[0].text if result.content else ""
            log(f"TOOL RESULT{' (isError)' if attr(result, 'isError', 'is_error') else ''}: {clip(text)}")
            messages.append({"role": "tool", "tool_call_id": call.id, "content": text})
    log(f"STOPPED: no final answer after {MAX_STEPS} steps")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", help="run only this prompt")
    parser.add_argument("--out", help="write the transcript to this file")
    parser.add_argument("--read-only", action="store_true", help="start the MCP server without writing tools (session 7 safeguard)")
    args = parser.parse_args()

    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("CHAT_AI_API_KEY")
    model = os.environ.get("LLM_MODEL")
    if not api_key or not model:
        sys.exit("Set LLM_API_KEY (or CHAT_AI_API_KEY) and LLM_MODEL. See the docstring at the top of this file.")
    client = OpenAI(api_key=api_key, base_url=os.environ.get("LLM_BASE_URL", "https://chat-ai.academiccloud.de/v1"))

    out = open(args.out, "w", encoding="utf-8") if args.out else None

    def log(line: str) -> None:
        print(line, flush=True)
        if out:
            out.write(line + "\n")
            out.flush()

    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)] + (["--read-only"] if args.read_only else []), env=dict(os.environ))
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            listed = (await session.list_tools()).tools
            tools = [
                {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": attr(t, "inputSchema", "input_schema")}}
                for t in listed
            ]
            log(f"MODEL: {model}   TOOLS: {', '.join(t.name for t in listed)}")
            prompts = {"custom": args.prompt} if args.prompt else PROMPTS
            for name, prompt in prompts.items():
                log(f"\n===== {name.upper()} =====")
                await run_prompt(session, client, model, tools, prompt, log)
    if out:
        out.close()


if __name__ == "__main__":
    asyncio.run(main())
