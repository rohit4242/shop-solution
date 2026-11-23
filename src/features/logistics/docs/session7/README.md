# Logistics: Session 7 (cross-module flow, interaction and security)

Partner teams: **Storefront** and **Accounting** ("Order to Shipment" flow).

| #   | Deliverable                                  | Logistics part                                                                                                                                  | Where                                                                                                                                                                                                                                          |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `flow.md` signed off, updated `openapi.yaml` | Flow signed by Storefront; contract **1.3.0**                                                                                                   | [flow.md](flow.md), [../../api/openapi.yaml](../../api/openapi.yaml), [../../api/CONTRACT_REVIEW.md](../../api/CONTRACT_REVIEW.md)                                                                                                             |
| 2   | Flow code, contract tests, end-to-end test   | `createShipment` and the order lookup are implemented; our contract test against a partner API; a contract test the partners can run against us | [../../api/tests/test_partner_contract.py](../../api/tests/test_partner_contract.py), [for-partners/test_logistics_contract.py](for-partners/test_logistics_contract.py), [../../api/tests/test_session7.py](../../api/tests/test_session7.py) |
| 3   | `servers.json` and agent runs                | Logistics entries (full and read-only)                                                                                                          | [servers.json](servers.json)                                                                                                                                                                                                                   |
| 4   | Threat list and safeguard                    | Read-only MCP server                                                                                                                            | [threat-list.md](threat-list.md), [safeguard-evidence.md](safeguard-evidence.md), [evidence/](evidence/)                                                                                                                                       |

## Start the Logistics API and MCP server

From `src/features/logistics/api` (Python 3.11+):

```sh
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn erp_logistics_api:app --port 8000          # API, docs at http://localhost:8000/docs
python mcp_server.py                               # MCP server, all 6 tools
python mcp_server.py --read-only                   # MCP server, 4 reading tools only
pytest tests -q                                    # 155 tests
```

The MCP server reads the API address from `LOGISTICS_API_BASE_URL` (default `http://localhost:8000`).

## For the partner teams

- **Accounting** calls `POST /shipments` after payment, with `paymentStatus: "PAID"` and optionally `paymentReference`. A `409` means the order already has a shipment: read it with `GET /shipments?orderId=…`.
- **Storefront** calls `GET /shipping/methods` at checkout. Showing carrier and tracking number on the order page with `GET /shipments?orderId=…` is optional; live parcel tracking is the carrier's.
- Add your own server next to ours in `servers.json`, e.g. `"storefront": { "module": "storefront", "args": ["path/to/your_mcp_server.py"] }`.
- Copy [for-partners/test_logistics_contract.py](for-partners/test_logistics_contract.py) into your tests to check our real API against our contract.

## Agent tasks across both modules (Part 3)

With both servers in `servers.json` and both APIs running:

1. "Which paid orders have no shipment yet?" (reads Storefront or Accounting, then `logistics__list_shipments`)
2. "Create the missing shipment for order O-…", run once **without** `--yes`, and record what the agent asks before writing.
