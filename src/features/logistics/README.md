# Logistics

Logistics owns shipments, carrier status and tracking history. The Next.js
workspace at `/logistics` calls `/api/v1/logistics/shipments`. The gateway
checks the staff session, validates requests with Zod and forwards them to
FastAPI. [OpenAPI](api/openapi.yaml) defines shipment creation, listing and
tracking, status updates and event history, including their error responses.
The Python service stores shipments in memory and resets them on restart.

## Run the local demo

From the repository root with Node 24, pnpm 12.14.0 and Python 3.12+:

```sh
pnpm install --frozen-lockfile
python -m venv .venv
```

Activate the virtual environment (`.\.venv\Scripts\Activate.ps1` in
PowerShell or `source .venv/bin/activate` in Bash), then run:

```sh
python -m pip install -r requirements-logistics.txt
python scripts/logistics-demo.py
```

Visit `http://127.0.0.1:3000/logistics` and sign in as
`staff@logistics.demo` with password `logistics-demo`. The launcher starts
both local servers on ports 3000 and 8000 and generates per-run secrets.
The development launcher uses Webpack on Windows.
If the default ports are occupied, pass `--web-port 3300 --api-port 8300`.
To rehearse with the production build on Windows, run
`pnpm exec next build --webpack` and then
`python scripts/logistics-demo.py --production`.
The sample paid order, carrier report and Storefront page are simulated.
PostgreSQL is only needed for database-backed shared authentication.

Create a shipment using **Use demo paid order**, then filter by order ID and
open the tracking details. Submit `DELIVERED` from `CREATED` to show the
rejection. Use the same UTC report time for `LABEL_CREATED` to show a valid
update and its history. Choose a timestamp later than the shipment's last
update, with milliseconds and a trailing `Z`. The Storefront link demonstrates
the order handoff using the current order ID.

## Shared application

Outside demo mode, the gateway requires a Better Auth session with an email
in `LOGISTICS_STAFF_EMAILS`. Configure `LOGISTICS_API_URL` and
`LOGISTICS_API_TOKEN` for the upstream service. The browser's staff-session
endpoint does not serve as service-to-service authentication for Accounting.

- **Paid-order owner or Accounting.** Agree who verifies payment and calls
  the shipment API, how the caller authenticates and how retries are handled.
  Agreed in session 7: Accounting verifies payment and calls the shipment API.
  The request requires `orderId`, `customerId`, `paymentStatus: PAID`,
  `shippingAddress` and `shippingMethod` (`STANDARD` or `EXPRESS`), and may
  carry an optional `paymentReference` (contract 1.1.0). Other extra fields are
  rejected. A second shipment for the same order returns
  `409 ORDER_ALREADY_HAS_SHIPMENT`.
- **Order ids** `O-…`, `M-…` and Accounting's `ORD-…` are accepted (contract 1.3.0).
- **Storefront checkout.** `GET /shipping/methods` (contract 1.2.0) lists the
  delivery options with carrier, delivery time and price.
- **Session 7.** Flow, threat list, safeguard and `servers.json` are in
  [docs/session7](docs/session7/README.md).
- **Storefront.** Agree on an order-detail URL and shared login. Set
  `NEXT_PUBLIC_LOGISTICS_STOREFRONT_URL` to the URL prefix. Logistics appends
  the encoded order ID. The local demo page is reachable only in demo mode.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
python -m pytest -o pythonpath=src/features/logistics/api src/features/logistics/api/tests -q
python -m playwright install chromium
python -m pytest tests/e2e/test_logistics.py -q
```

Run the browser checks in a second terminal while the demo servers are running.
For custom ports, set `LOGISTICS_DEMO_TEST_URL` and
`LOGISTICS_DEMO_TEST_API_URL` to the web and API base URLs.
