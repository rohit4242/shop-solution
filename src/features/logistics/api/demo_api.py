"""Opt-in local adapter. Original Session 5 domain API is unchanged."""
import os
import re
import secrets
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from erp_logistics_api import app
TOKEN = os.environ.get("LOGISTICS_API_TOKEN")
if not TOKEN:
    raise RuntimeError("Set LOGISTICS_API_TOKEN before running the local adapter")
ACCOUNTING_TOKEN = os.environ.get("LOGISTICS_ACCOUNTING_TOKEN")
STOREFRONT_TOKEN = os.environ.get("LOGISTICS_STOREFRONT_TOKEN")
configured_tokens = [token for token in (TOKEN, ACCOUNTING_TOKEN, STOREFRONT_TOKEN) if token]
if len(set(configured_tokens)) != len(configured_tokens):
    raise RuntimeError("Use distinct tokens for Logistics, Accounting and Storefront")


def has_token(authorization: bytes, token: str | None) -> bool:
    return bool(token) and secrets.compare_digest(
        authorization, f"Bearer {token}".encode("utf-8")
    )


app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
@app.middleware("http")
async def require_demo_token(request, call_next):
    # /shipping/methods (contract 1.2.0) is public read-only checkout data, so it needs no token.
    if request.url.path.startswith("/shipments") and request.method != "OPTIONS":
        authorization = request.headers.get("authorization", "").encode("latin-1")
        if has_token(authorization, TOKEN):
            return await call_next(request)
        if has_token(authorization, ACCOUNTING_TOKEN):
            allowed = request.method == "POST" and request.url.path.rstrip("/") == "/shipments"
        elif has_token(authorization, STOREFRONT_TOKEN):
            path = request.url.path.rstrip("/")
            lookup = path == "/shipments" and bool(request.query_params.get("orderId"))
            history = re.fullmatch(r"/shipments/S-[0-9]{4,}/events", path)
            allowed = request.method == "GET" and (lookup or history is not None)
        else:
            return JSONResponse(status_code=401, content={"error": {"code": "UNAUTHENTICATED", "message": "A valid adapter token is required"}})
        if not allowed:
            return JSONResponse(status_code=403, content={"error": {"code": "FORBIDDEN", "message": "This service cannot perform that operation"}})
    return await call_next(request)
