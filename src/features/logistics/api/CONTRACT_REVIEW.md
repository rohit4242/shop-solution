# Contract review: Logistics x Storefront

Contract: `openapi.yaml`, version **1.3.0** (session 7). Storefront signed off version **1.1.0**; 1.2.0 adds the shipping-methods operation Storefront requested and 1.3.0 accepts Accounting's order id format (see "Logistics follow-up" at the end). The history below is kept as the record of the session 5 review.
Status: **Agreed.** Storefront confirms and signs off on OpenAPI contract version **1.1.0** and the cross-module "Order to Shipment" flow (`session7/flow.md`). All open questions have been answered and aligned with Accounting.

## First message from Storefront: order payload

```json
{
  "customerId": "C-1",
  "cartItems": [{ "productId": "P-1", "quantity": 2 }],
  "paymentReference": "PAY-1",
  "totalAmount": 35.98,
  "currency": "EUR",
  "shippingMethod": "standard",
  "shippingAddress": {
    "recipientName": "Max Mustermann",
    "street": "Musterstrasse 1",
    "postalCode": "94469",
    "city": "Deggendorf",
    "country": "DE"
  }
}
```

## Comparison with what Logistics needs (`createShipment`)

| Field                           | Storefront sends                           | Logistics needs                | Result                                                                                                                                                               |
| ------------------------------- | ------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customerId`                    | `C-1`                                      | opaque string                  | OK as is                                                                                                                                                             |
| `shippingAddress.recipientName` | yes                                        | yes                            | **We adopted their name** (was `fullName`)                                                                                                                           |
| `shippingAddress.country`       | `DE`                                       | 2-letter ISO code              | **We adopted their name** (was `countryCode`)                                                                                                                        |
| `street`, `postalCode`, `city`  | yes                                        | yes                            | OK as is                                                                                                                                                             |
| `shippingMethod`                | `"standard"` (lowercase)                   | `STANDARD` / `EXPRESS`         | **Open:** enum is uppercase in this ERP's convention. Ask Storefront to send uppercase, or we accept lowercase and normalise.                                        |
| `orderId`                       | **missing**                                | required (`O-` + digits)       | **Open:** the payload has no order id. Who creates it and when?                                                                                                      |
| `paymentStatus`                 | **missing** (they send `paymentReference`) | must be `PAID` before shipping | **Open:** who confirms payment, Storefront or Accounting? Logistics only ships paid orders.                                                                          |
| `cartItems`                     | yes                                        | not needed for status tracking | Not in the contract. It could become an optional `items` list later (parcel contents, weight).                                                                       |
| `totalAmount`, `currency`       | yes                                        | not needed                     | Not in the Logistics contract. Note for Storefront/Accounting: the repo convention is money in integer minor units with a currency, so `35.98` should become `3598`. |

## Changes made in v0.2.0-draft

1. `shippingAddress.fullName` renamed to `recipientName`.
2. `shippingAddress.countryCode` renamed to `country` (same format: 2 capital letters).

No other field changed. The code and tests were updated together and pass.

## Second message from Storefront: `getOrder` and `listCustomerOrders`

Storefront asked whether Logistics can also return one order or a customer's orders, and sent the doc _Proposed Order Fields for Logistics_ (`GET /orders/{orderId}`, `GET /customers/{customerId}/orders`). Our answer:

| Point in their doc                                      | Finding                                                                                                                        | Action                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `orderId` "created by Logistics"                        | **Wrong owner.** Storefront creates orders (their module creates an order from a cart). Logistics only receives the `orderId`. | Tell Storefront; we need the `orderId` in the message we receive.                                                               |
| `getOrder` / `listCustomerOrders`                       | These are order operations, so they belong to Storefront.                                                                      | Logistics does not implement them. It supplies the delivery part.                                                               |
| Ids like `O-1`, `C-1`                                   | Our `orderId` pattern required 4+ digits (`O-1001`), so `O-1` would have been **rejected**.                                    | **Changed in v0.3.0-draft:** `^[OM]-[0-9]+$`. The lecture slides also name `M-` ids from the Marketplace, so both are accepted. |
| `tracking.trackingNumber` (`TRK-1`)                     | We issue `TRK-2001`-style numbers.                                                                                             | Tracking number now has the form `TRK-<digits>`.                                                                                |
| `tracking.shipmentStatus` (`in_transit`)                | Our enum is uppercase (`IN_TRANSIT`).                                                                                          | Ask Storefront to use our 8 values unchanged, or map them on their side.                                                        |
| Order `status` (`shipped`, `delivered`)                 | Derived from our status.                                                                                                       | Proposed mapping below.                                                                                                         |
| `shipping.estimatedDelivery`                            | Logistics has no delivery estimate yet.                                                                                        | Not provided. Ask whether it is needed.                                                                                         |
| `listCustomerOrders` needs delivery status per customer | We could only look up by order.                                                                                                | **Added in v0.3.0-draft:** `customerId` on every shipment and a `customerId` filter on `listShipments`.                         |
| `cursor` paging                                         | We use `page` / `pageSize`.                                                                                                    | Both are fine; they are separate APIs.                                                                                          |

Proposed mapping, for Storefront to confirm: no shipment or `CREATED` / `LABEL_CREATED` = order `confirmed`; `IN_TRANSIT` / `OUT_FOR_DELIVERY` / `DELIVERY_FAILED` = `shipped`; `DELIVERED` = `delivered`; `RETURNED` / `CANCELLED` = needs a decision (cancelled or a separate state).

## Storefront confirmation, architectural clarifications, and answers to open questions

Storefront has reviewed Logistics' proposals and queries. To ensure clear boundaries, we provide our answers along with important architectural clarifications:

### Architectural Context & Ownership (Storefront Design)

- **Only shipping paid orders was Storefront's architectural proposal, not Logistics'**:  
  Prior proposals had Storefront broadcasting fragmented order payloads simultaneously to Payment, Marketing, and Logistics—an anti-pattern that violates clean microservice separation of concerns. Storefront established the clean, sequential ERP pipeline: **Storefront $\to$ Accounting $\to$ Logistics**.
- **Accounting & Payment reality**:  
  Storefront creates the order and sends all order and payment details to Accounting (who requires these line items and totals to generate the official invoice). Accounting then verifies/confirms the payment as `PAID` before handing the order to Logistics (`POST /shipments`).  
  _Note on Payment implementation:_ Storefront implemented credit card and saved payment handling in the checkout page and assumes payment completion directly **because Accounting refused to handle the payment collection side**. Although implementing payment handling was outside Storefront's original scope, Storefront took full responsibility to ensure the ERP system had an operational checkout. Accounting's role is to verify the payment status (`PAID`) and trigger Logistics.
- **Logistics' proposed reply**:  
  Logistics' proposed reply claims they need to receive payment status before delivery with order details, while simultaneously attempting to shift order management boundaries. To be clear: Storefront creates the order and sends all details to Accounting; Accounting confirms payment and triggers Logistics; Logistics is solely responsible for physical fulfillment. Storefront's responsibility is customer purchasing and checkout—granular shipping status and fulfillment progression belong to Logistics, CRM, and Accounting.

---

### Answers to Open Questions

1. **Who emits `OrderReadyForShipping`, Storefront or Accounting, and when (after payment is confirmed)?**  
   **Answer: Accounting.** As designed by Storefront, Storefront creates the order and submits all invoice/payment data to Accounting. Once Accounting verifies and settles the payment, Accounting calls Logistics' `POST /shipments` with `paymentStatus: "PAID"`.

2. **The order needs an `orderId` like `O-1001`. Which team creates it? Can it be added to your payload?**  
   **Answer: Storefront.** Storefront creates the `orderId` (e.g. `O-1001`, `O-5004`, or `ORD-100001` conforming to `^[OM]-[0-9]+$`) at checkout creation time. Storefront sends it to Accounting, which forwards it to Logistics in `createShipment`.

3. **Can you send `shippingMethod` as `STANDARD` / `EXPRESS` (uppercase)?**  
   **Answer: Yes, but dynamic API-driven shipping methods were agreed with your team.**  
   While Storefront can transmit uppercase values for backwards compatibility, hardcoding static `STANDARD` / `EXPRESS` strings is rigid. **As already discussed and agreed with one of your team members, Logistics will expose an API endpoint (e.g., `GET /shipping/methods` or `GET /shipping/options`)** that returns available methods, carrier names (e.g. DHL, UPS, Hermes), descriptions, and real-time prices. This allows Logistics to adjust pricing, delivery estimates, or carrier options dynamically without requiring contract schema changes or frontend redeployments.

4. **Logistics ships only paid orders, so we need `paymentStatus: "PAID"` in the message. Where does it come from?**  
   **Answer: Accounting (Storefront's architectural design).**  
   As noted above, having Logistics fulfill only paid orders was Storefront's architectural proposal to prevent invalid fulfillment and eliminate circular broadcasts. Accounting verifies payment settlement and injects `paymentStatus: "PAID"` (along with `paymentReference`) when calling `POST /shipments`.

5. **What do you want back from us? We propose: `GET /shipments?orderId=O-1001` (status and tracking number) and the `ShipmentStatusChanged` event. Do you also want `attemptCount` ("Attempt 2 of 3") in the event? It is optional and marked as a proposal.**  
   **Answer:**
   - **Dynamic Shipping Methods API:** In addition to shipment lookup, Storefront requires a `GET /shipping/methods` (or `GET /shipping/options`) endpoint to dynamically retrieve delivery methods, carriers, descriptions, and current prices during checkout Step 2.
   - **Shipment Lookup:** Storefront will query `GET /shipments?orderId=O-...` to display carrier (`carrierCode`), tracking number (`trackingNumber`), and high-level delivery status for order confirmation.
   - **Shipment Events:** Storefront can query `GET /shipments/{shipmentId}/events` for tracking history.
   - **`attemptCount`:** Confirmed as an **optional** property. Storefront does not require it for core checkout or order confirmation.
   - _Note on Shipping Status:_ Storefront is an e-commerce purchasing portal; granular fulfillment status lifecycles are the concern of Logistics and Accounting/CRM.

6. **Can one order produce several shipments (split orders)? We assume one shipment per order for now.**  
   **Answer: Confirmed.** One shipment per order is agreed. Storefront supports the `409 ORDER_ALREADY_HAS_SHIPMENT` idempotency handling defined in `flow.md`.

7. **Should the customer be notified after each failed delivery? That is your decision; Logistics only provides the status.**  
   **Answer: CRM responsibility (Pending CRM clarification).**  
   **CRM** is the ERP module responsible for customer data, communication, and delivery notifications. For the time being, Storefront has not received a reply from the CRM team regarding notification ownership. Storefront will not assume CRM notification workflows; Logistics and CRM must align on delivery failure notifications.

---

### Storefront Official Reply to Logistics

> Hi Logistics team,
>
> Thanks for adapting the address format (`recipientName`, 2-letter `country`) and supporting flexible order IDs (such as `O-1001`).
>
> Here is our official feedback on the contract and architecture:
>
> 1. **Decoupled Architecture & Payment**:  
>    As Storefront originally proposed, Logistics only ships paid orders. Storefront creates the order and passes all order and payment information to Accounting so they can generate the invoice. Accounting then confirms payment (`paymentStatus: "PAID"`) and triggers `POST /shipments`. Please note that Storefront implemented client-side payment processing in our checkout because Accounting refused to take on payment collection; Accounting's role is to confirm settlement and notify you.
> 2. **Dynamic Shipping Methods API (`GET /shipping/methods`)**:  
>    As discussed and agreed with one of your team members, instead of restricting delivery methods to static enums (`STANDARD` / `EXPRESS`), Logistics will provide a `GET /shipping/methods` endpoint returning available carriers, descriptions, estimated delivery times, and prices dynamically. This avoids hardcoding rates and allows you to adjust pricing or add delivery options without frontend redeployments.
> 3. **Storefront Queries & Status**:  
>    Storefront will query `GET /shipments?orderId=...` for tracking number, carrier, and basic status, as well as `GET /shipments/{shipmentId}/events` for timeline history. Granular shipping status lifecycles belong to Logistics, CRM, and Accounting.
> 4. **Customer Notifications (CRM)**:  
>    Customer communications and shipping notifications belong to the CRM module. We are currently awaiting a clarification reply from the CRM team on their notification handling.
> 5. **One Shipment per Order**:  
>    Agreed; `409 ORDER_ALREADY_HAS_SHIPMENT` idempotency is accepted.

## Logistics follow-up to Storefront's confirmation (session 7)

| Storefront's point              | What Logistics did                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-off of 1.1.0 and `flow.md` | Recorded. `paymentReference` is accepted as an optional field.                                                                                                                                                                                                                                                                                                               |
| `GET /shipping/methods`         | **Added in 1.2.0** as `listShippingMethods`. Each method has `code` (`STANDARD` / `EXPRESS`, the value sent later as `shippingMethod`), `carrierCode`, `name`, `description`, `estimatedDeliveryDays` and `price` in minor units. Prices and delivery times are demo values. `shippingMethod` in `createShipment` stays the same enum, so nothing that already works breaks. |
| Order id `ORD-100001`           | Storefront clarified that this is the format Accounting asked for. **Accepted since 1.3.0** (`^(O                                                                                                                                                                                                                                                                            | M   | ORD)-[0-9]+$`), in addition to `O-…`and`M-…`. |
| "Aligned with Accounting"       | Accounting is asked to confirm `flow.md` and `paymentReference` in its own name.                                                                                                                                                                                                                                                                                             |
| Shipment tracking (later reply) | Storefront does not show tracking; live parcel tracking is the carrier's. Logistics still provides carrier, tracking number and status; showing a one-line note on the order page is optional for Storefront (`flow.md`, step 3).                                                                                                                                            |
| Customer notifications          | CRM's decision; Logistics provides the status only.                                                                                                                                                                                                                                                                                                                          |

## Change log

| Version     | Change                                                                                                                                                                                                                      | Agreed by                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0.1.0-draft | First draft from week-1/week-4 work (MODULE.md, `contracts.ts`)                                                                                                                                                             | nobody yet                                                                                       |
| 0.2.0-draft | Address fields follow Storefront's payload (`recipientName`, `country`)                                                                                                                                                     | **confirmed by Storefront**                                                                      |
| 0.3.0-draft | Order ids may be short (`O-1`); `customerId` added to `Shipment`; `customerId` filter on `listShipments`; tracking number `TRK-<digits>`                                                                                    | **confirmed by Storefront**                                                                      |
| 1.0.0       | Same content as 0.3.0-draft. Open questions answered by the agreed "Order to Shipment" flow: Storefront creates the `orderId`, Accounting confirms payment and calls `createShipment`, `shippingMethod` is sent in capitals | Storefront, Accounting, Logistics (flow diagram); written sign-off in `../docs/session7/flow.md` |
| 1.1.0       | **Addition:** optional `paymentReference` on `OrderReadyForShipping` and `Shipment`. Accounting sends it with the paid order; before 1.1.0 the extra field would have been rejected with 422. No field renamed or removed   | Storefront, Accounting, Logistics; agreed in `flow.md`                                           |
| 1.2.0       | **Addition:** `listShippingMethods` (`GET /shipping/methods`) for Storefront's checkout, with the schemas `ShippingMethodOption`, `ShippingMethodList` and `Money`. No field renamed or removed                             | requested by Storefront; confirmation of the response format pending                             |
| 1.3.0       | **Addition:** `orderId` also accepts Accounting's format `ORD-` + digits (`^(O                                                                                                                                              | M                                                                                                | ORD)-[0-9]+$`). Old ids keep working. No field renamed or removed | taken by Logistics while Accounting's reply was pending; see `flow.md` |

## Assumptions we made without partner input

- One shipment per order.
- The carrier is chosen by Logistics from the shipping method (STANDARD = DHL, EXPRESS = UPS) and the tracking number is assigned at creation (simulated carrier).
- `customerId` is opaque to Logistics.
- `attemptCount` is a proposal.
