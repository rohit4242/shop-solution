"""Contract test against a PARTNER's real, running API (session 7), in the style of the lecture.

Logistics is the consumer here: we check that the partner's real API returns every field its own
openapi.yaml marks as required. It is skipped unless the partner's details are given:

    PARTNER_OPENAPI=path/to/partner/openapi.yaml   # the partner's contract
    PARTNER_BASE_URL=http://localhost:8001          # the partner's running API
    PARTNER_SCHEMA=Order                            # schema name in the partner's components
    PARTNER_PATH=/orders/O-5004                     # a GET path that returns one such object

Example: PARTNER_OPENAPI=../storefront/openapi.yaml PARTNER_BASE_URL=http://localhost:8001 \
         PARTNER_SCHEMA=Order PARTNER_PATH=/orders/O-1 pytest tests/test_partner_contract.py -q
"""

import json
import os
import urllib.request

import pytest
import yaml

NEEDED = ("PARTNER_OPENAPI", "PARTNER_BASE_URL", "PARTNER_SCHEMA", "PARTNER_PATH")
pytestmark = pytest.mark.skipif(
    not all(os.environ.get(name) for name in NEEDED),
    reason="set PARTNER_OPENAPI, PARTNER_BASE_URL, PARTNER_SCHEMA and PARTNER_PATH to test a partner API",
)


def test_partner_api_returns_all_required_fields_of_its_contract():
    with open(os.environ["PARTNER_OPENAPI"], encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    schema = spec["components"]["schemas"][os.environ["PARTNER_SCHEMA"]]
    required = set(schema.get("required", []))
    url = os.environ["PARTNER_BASE_URL"].rstrip("/") + os.environ["PARTNER_PATH"]
    with urllib.request.urlopen(url, timeout=10) as response:
        body = json.load(response)
    missing = required - body.keys()
    assert not missing, f"fields missing from the partner's contract: {missing}"
