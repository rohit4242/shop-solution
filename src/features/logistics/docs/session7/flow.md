# Flow: Order to Shipment

Teams: Storefront, Accounting, Logistics. Based on the "Order to Shipment" diagram the three teams agreed in session 6.
Status: **signed by Storefront** (contract 1.1.0 and this flow); Accounting's and Logistics' signatures pending (see the table at the end).

## Trigger

A customer's order is **paid**. The order is created in **Storefront**; **Accounting** confirms the payment and creates the invoice. The payment confirmation in Accounting starts the Logistics part of the flow.

## Steps

| #   | Caller → provider                 | Operation                                                    | Data sent                                                                                                                                                                                                                          | Data returned                                                                                               |
| --- | --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0   | Storefront → Logistics            | `listShippingMethods` `GET /shipping/methods` (checkout)     | —                                                                                                                                                                                                                                  | delivery options: `code`, `carrierCode`, `name`, `estimatedDeliveryDays`, `price`                           |
| 1   | Storefront → Accounting           | Accounting's operation for a new order (Accounting contract) | `orderId`, `customerId`, `shippingAddress`, `shippingMethod`                                                                                                                                                                       | —                                                                                                           |
| 2   | Accounting → Logistics            | `createShipment` `POST /shipments`                           | `orderId` (`O-…`, `M-…` or `ORD-…`), `customerId`, `paymentStatus: "PAID"`, `shippingAddress` (`recipientName`, `street`, `postalCode`, `city`, `country`), `shippingMethod` (`STANDARD` / `EXPRESS`), optional `paymentReference` | `201` with the shipment: `shipmentId` (e.g. `S-2001`), `status: "CREATED"`, `carrierCode`, `trackingNumber` |
| 3   | (optional) Storefront → Logistics | `listShipments` `GET /shipments?orderId=…`                   | `orderId`                                                                                                                                                                                                                          | carrier, tracking number and status of the order's shipment                                                 |

The result of step 2 is visible in two places: in the **response to Accounting** (`shipmentId`, `status`) and on the **Logistics page** of the shared frontend, where the new shipment appears. Step 3 is offered to Storefront for a one-line note on the order page ("Shipped with DHL, tracking number TRK-2001"); Storefront decides whether to use it.

Logistics never pushes data: every return arrow is the answer to a request. Each partner calls the protected API with its own token (`demo_api.py`): Accounting may only call step 2, Storefront only step 3; step 0 needs no token. Data is in memory for now.

**Tracking.** Live parcel tracking (where the parcel is now) is done by the carrier on its own website, not by Logistics or Storefront. Logistics provides the carrier, the tracking number and the shipment status, which the carrier reports through `applyStatusUpdate`.

## Contract changes

| Contract                  | Before       | After        | Change                                                                                                                                                                                                                 |
| ------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logistics `openapi.yaml`  | 0.3.0-draft  | **1.3.0**    | 1.0.0 = 0.3.0-draft agreed in this flow. 1.1.0: optional `paymentReference`. 1.2.0: `listShippingMethods` for Storefront's checkout. 1.3.0: order ids in Accounting's format `ORD-…` are accepted too. Additions only. |
| Storefront `openapi.yaml` | (Storefront) | (Storefront) | Storefront fills in its version                                                                                                                                                                                        |
| Accounting `openapi.yaml` | (Accounting) | (Accounting) | Accounting fills in its version, incl. the call to Logistics                                                                                                                                                           |

## Errors

| Situation                                                                   | Who notices                                                          | What happens                                                                                                                                                                              |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logistics is down when Accounting calls step 2                              | Accounting (connection error or `5xx`)                               | The payment stays confirmed. Accounting keeps the order as "paid, shipment pending" and retries later. The flow must not lose the order.                                                  |
| Accounting retries an order that already got a shipment                     | Logistics answers `409 ORDER_ALREADY_HAS_SHIPMENT`                   | Accounting treats this as success and reads the shipment with `GET /shipments?orderId=…` (internal token) or keeps the `shipmentId` from the first answer. No second shipment is created. |
| Invalid data in step 2 (unknown id format, lowercase method, missing field) | Logistics answers `422 VALIDATION_ERROR` with a message              | Accounting logs it and does not retry; this is a bug to fix, not a temporary failure.                                                                                                     |
| Order not paid (`paymentStatus` not `PAID`)                                 | Logistics answers `422`                                              | No shipment is created.                                                                                                                                                                   |
| Missing or wrong token                                                      | Logistics answers `401`, or `403` for a call outside the team's role | The caller fixes its configuration; no data changes.                                                                                                                                      |
| Logistics is down when Storefront asks (steps 0 and 3)                      | Storefront                                                           | Checkout and order page still work; the delivery options or the shipment note are shown as unavailable.                                                                                   |

## Acceptance criteria

1. **Given** a paid order O-5004, **when** Accounting sends it to `POST /shipments`, **then** Logistics answers 201 with a `shipmentId`, status `CREATED`, a carrier and a tracking number, and the shipment appears on the Logistics page.
2. **Given** O-5004 already has a shipment, **when** Accounting sends it again, **then** Logistics answers 409 and there is still exactly one shipment for O-5004.
3. **Given** Accounting sends an order id `ORD-100001`, **when** the shipment is created, **then** it is found with `GET /shipments?orderId=ORD-100001`.
4. **Given** Accounting sends `paymentReference: "PAY-1"`, **when** the shipment is read, **then** it carries `paymentReference: "PAY-1"`; **given** a client sends no `paymentReference`, **then** the request still succeeds.
5. **Given** the Logistics API is stopped, **when** Accounting confirms a payment, **then** the order stays "paid, shipment pending" and a shipment is created after Logistics is back.
6. **Given** the checkout, **when** Storefront calls `GET /shipping/methods`, **then** it gets `STANDARD` and `EXPRESS` with carrier, delivery time and price, and the carrier shown is the carrier the shipment later gets.
7. **Given** Storefront's token, **when** it tries `POST /shipments`, **then** Logistics answers 403 and no shipment is created.

Logistics' side of criteria 1–4, 6 and 7 is covered by `api/tests/test_session7.py`, `api/tests/test_partner_access.py` and the existing API tests. Criterion 5 is checked on the Accounting side.

## Decisions Logistics took while waiting for replies

Accounting and one Logistics member had not answered when this was written. To keep the flow working for every possible answer, Logistics chose options that break nothing:

| Open question                                        | Decision                                                                                             | Why it is safe                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Which order id format does Accounting send?          | Accept `ORD-…` **in addition to** `O-…` and `M-…` (1.3.0)                                            | Works whichever format Accounting uses; old ids still work.     |
| Will Storefront show the shipment on the order page? | Step 3 is **optional**; the demo shows the result on the Logistics page and in Accounting's response | The flow can be shown without depending on Storefront's choice. |
| Who signs for Accounting?                            | Signature left open                                                                                  | Accounting confirms in its own name.                            |

## Sign-off

| Team       | Name            | Date       | Signed                                                                                       |
| ---------- | --------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Storefront | Storefront team | 2026-11-22 | ✓ written confirmation of contract 1.1.0 and this flow, recorded in `api/CONTRACT_REVIEW.md` |
| Accounting |                 |            |                                                                                              |
| Logistics  |                 |            |                                                                                              |
