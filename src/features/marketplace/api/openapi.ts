import { z } from "zod";
import {
  catalogQuerySchema,
  createOfferSchema,
  listOffersQuerySchema,
  listSalesQuerySchema,
  listSellersQuerySchema,
  recordSaleSchema,
  registerSellerSchema,
  rejectSchema,
  updateOfferSchema,
  updateSellerSchema,
} from "../schemas/marketplace.schema";
import { CATEGORIES } from "../types/marketplace";

// Builds the Marketplace OpenAPI document. Request bodies and query parameters
// come from the Zod schemas the routes validate with, so they cannot drift.
// The committed api/openapi.yaml is this document; tests/contract.test.ts checks it.
// Regenerate: node --import tsx scripts/export-marketplace-contract.ts

export const MARKETPLACE_API_VERSION = "3.0.0";

type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const input = (schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  }) as Schema;
  delete json.$schema;
  return json;
};

const nullable = (schema: Schema) => ({ anyOf: [schema, { type: "null" }] });
const str = (extra: Schema = {}) => ({ type: "string", ...extra });
const int = (extra: Schema = {}) => ({ type: "integer", ...extra });
const dateTime = str({ format: "date-time" });
const obj = (properties: Record<string, unknown>, extra: Schema = {}) => ({
  type: "object",
  required: Object.keys(properties),
  properties,
  ...extra,
});

const schemas: Record<string, unknown> = {
  SellerStatus: str({ enum: ["pending", "active", "suspended", "terminated"] }),
  OfferStatus: str({
    enum: ["draft", "pending", "active", "rejected", "blocked", "removed"],
    description: "Moderation status. Public reads only return `active`.",
  }),
  InvoiceStatus: str({
    enum: ["pending", "invoiced", "refused"],
    description:
      "Hand-off to Accounting: `pending` (not booked yet, retry possible), `invoiced`, `refused` (Accounting said no).",
  }),
  Category: str({ enum: [...CATEGORIES] }),
  Availability: str({ enum: ["in_stock", "out_of_stock"] }),
  Address: obj({
    street: str(),
    postalCode: str(),
    city: str(),
    country: str({ pattern: "^[A-Z]{2}$", description: "ISO 3166-1 alpha-2" }),
  }),
  Seller: obj(
    {
      sellerId: str({
        pattern: "^sel_[a-z0-9]+$",
        examples: ["sel_3f2a9c01b4d5e6f7"],
      }),
      displayName: str({ examples: ["Anna's Ceramics"] }),
      status: ref("SellerStatus"),
      createdAt: dateTime,
    },
    { description: "Public view of a shop." },
  ),
  SellerAccount: {
    description:
      "A shop with private details. Only for its owner and seller moderators.",
    allOf: [
      ref("Seller"),
      obj({
        userId: str({ description: "Better Auth user ID of the shop owner." }),
        legalName: str(),
        contactEmail: str({ format: "email" }),
        address: ref("Address"),
        statusReason: nullable(
          str({ description: "Why the registration was rejected." }),
        ),
      }),
    ],
  },
  MyShop: obj({
    seller: nullable(ref("SellerAccount")),
    rejectedReason: nullable(
      str({
        description:
          "Reason of the last rejected registration when there is no current shop.",
      }),
    ),
  }),
  Variation: obj({
    variationId: str({ pattern: "^var_[a-f0-9]{32}$" }),
    label: str({ examples: ["Blue / M"] }),
    priceMinor: int({ minimum: 1 }),
    currency: str({ enum: ["EUR"] }),
    stock: int({ minimum: 0 }),
    availability: ref("Availability"),
    imageIds: { type: "array", items: str() },
    imageUrls: {
      type: "array",
      items: str(),
      description:
        "The variation's images, or the offer images when it has none.",
    },
    inheritsImages: { type: "boolean" },
  }),
  Offer: obj(
    {
      offerId: str({ pattern: "^off_[a-z0-9]+$" }),
      productId: str({ pattern: "^prd_[a-z0-9]+$" }),
      sellerId: str({ pattern: "^sel_[a-z0-9]+$" }),
      name: str({ examples: ["Stoneware mug"] }),
      description: str(),
      category: ref("Category"),
      attributes: { type: "object", additionalProperties: str() },
      priceMinor: int({
        minimum: 1,
        description:
          "VAT-inclusive cents. The cheapest variation when variations exist.",
        examples: [1999],
      }),
      startingPriceMinor: int({ minimum: 1 }),
      maximumPriceMinor: int({ minimum: 1 }),
      currency: str({ enum: ["EUR"] }),
      stock: int({
        minimum: 0,
        description: "Sum of variation stock when variations exist.",
      }),
      availability: ref("Availability"),
      imageIds: { type: "array", items: str() },
      imageUrls: {
        type: "array",
        items: str(),
        description: "Paths on this application's origin, main image first.",
      },
      variations: { type: "array", items: ref("Variation") },
      lengthCm: nullable({ type: "number" }),
      widthCm: nullable({ type: "number" }),
      heightCm: nullable({ type: "number" }),
      weightGrams: nullable({ type: "number" }),
      status: ref("OfferStatus"),
      statusReason: nullable(
        str({ description: "Why the offer was rejected." }),
      ),
      updatedAt: dateTime,
    },
    { description: "A seller's listing." },
  ),
  Product: {
    allOf: [ref("Offer"), obj({ sellerDisplayName: str() })],
  },
  CatalogPage: obj({
    items: { type: "array", items: ref("Offer") },
    nextCursor: nullable(
      str({
        description:
          "Pass as `cursor` for the next page. Null on the last page.",
      }),
    ),
  }),
  SaleLine: obj({
    saleId: str({ pattern: "^sal_[a-z0-9]+$" }),
    orderId: str(),
    offerId: str(),
    sellerId: str(),
    quantity: int({ minimum: 1 }),
    unitPriceMinor: int({ description: "Unit price at the time of sale." }),
    grossMinor: int({ description: "`unitPriceMinor × quantity`." }),
    currency: str({ enum: ["EUR"] }),
    soldAt: dateTime,
    invoiceStatus: ref("InvoiceStatus"),
    invoiceId: nullable(
      str({ description: "Accounting's invoice ID once `invoiced`." }),
    ),
    invoiceError: nullable(
      str({ description: "Why the line is not invoiced." }),
    ),
  }),
  UploadedImage: obj({
    imageId: str({ pattern: "^img_[a-f0-9]{32}$" }),
    imageUrl: str(),
  }),
  Error: obj({
    error: obj(
      {
        code: str({ examples: ["OFFER_NOT_FOUND"] }),
        message: str(),
        fieldErrors: {
          type: "object",
          additionalProperties: { type: "array", items: str() },
        },
      },
      { required: ["code", "message"] },
    ),
  }),
  RegisterSellerRequest: input(registerSellerSchema),
  UpdateSellerRequest: input(updateSellerSchema),
  CreateOfferRequest: input(createOfferSchema),
  UpdateOfferRequest: input(updateOfferSchema),
  RejectRequest: input(rejectSchema),
  RecordSaleRequest: input(recordSaleSchema),
};

const envelope = (schema: unknown) => ({
  "application/json": { schema: obj({ data: schema }) },
});
const success = (description: string, schema: unknown, status = "200") => ({
  [status]: { description, content: envelope(schema) },
});
const list = (name: string) => ({ type: "array", items: ref(name) });

const ERROR_TEXT: Record<string, string> = {
  "400":
    "`VALIDATION_ERROR`: a field is missing or has the wrong type or format. `fieldErrors` names the fields.",
  "401": "`UNAUTHENTICATED`: no session (or no valid service token).",
  "403":
    "`FORBIDDEN`: missing permission, another seller's shop, or a request from another site.",
  "404": "The resource does not exist or is not public.",
  "409": "A business rule refused the change.",
  "413": "`IMAGE_TOO_LARGE`: more than 5 MiB.",
  "415": "`INVALID_IMAGE`: not a JPG, PNG or WEBP image.",
  "503":
    "`ACCOUNTING_UNAVAILABLE`: Accounting could not be reached; the sale stays pending.",
};
const errors = (codes: Record<string, string[]>) =>
  Object.fromEntries(
    Object.entries(codes).map(([status, names]) => [
      status,
      {
        description: names.length
          ? `${ERROR_TEXT[status]} Codes: ${names.map((n) => `\`${n}\``).join(", ")}.`
          : ERROR_TEXT[status],
        content: { "application/json": { schema: ref("Error") } },
      },
    ]),
  );

const pathParam = (name: string, pattern: string, example: string) => ({
  name,
  in: "path",
  required: true,
  schema: str({ pattern }),
  example,
});
const SELLER = pathParam("sellerId", "^sel_[a-z0-9]+$", "sel_3f2a9c01b4d5e6f7");
const OFFER = pathParam("offerId", "^off_[a-z0-9]+$", "off_3f2a9c01b4d5e6f7");

function queryParams(schema: z.ZodType) {
  const json = input(schema) as {
    properties?: Record<string, Schema>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, property]) => {
    const { description, ...rest } = property;
    return {
      name,
      in: "query",
      required: false,
      ...(description ? { description } : {}),
      schema: rest,
    };
  });
}

const body = (name: string) => ({
  required: true,
  content: { "application/json": { schema: ref(name) } },
});

const session = [{ session: [] }];
const service = [{ serviceToken: [] }];
const sessionOrService = [{ session: [] }, { serviceToken: [] }];

export function createMarketplaceOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Marketplace API",
      version: MARKETPLACE_API_VERSION,
      summary:
        "Seller onboarding, listings with moderation, the public catalog, and sales handed to Accounting.",
      description: [
        "Owned by the Marketplace team. Contract and rules: `src/features/marketplace/README.md`.",
        "",
        '- Success bodies are `{ "data": ... }`; failures are `{ "error": { code, message, fieldErrors? } }`.',
        "- Money is integer minor units, VAT included: `1999` = EUR 19.99. Only `EUR`.",
        "- Timestamps are ISO 8601 UTC.",
        "- Only offers that are `active` and whose shop is `active` are public.",
        "- Commission and payouts are Accounting's: Marketplace sends each sale line to Accounting.",
        "",
        "In-app features call the same operations directly from `@/features/marketplace/server`.",
        "",
        "3.0.0 moves the 2.2.0 API (FastAPI) into the shared Next.js app: routes under `/api/v1/marketplace`,",
        "the `{ data }` envelope, 400 instead of 422 for validation errors, Better Auth sessions instead of",
        "Identity bearer tokens, the shop owner taken from the session (no `userId` in `registerSeller`),",
        "`GET /sellers/me`, and `/sales/{saleId}/accounting-handoff` instead of `/commission-invoice`.",
      ].join("\n"),
    },
    servers: [{ url: "/api/v1/marketplace", description: "This application" }],
    tags: [
      {
        name: "catalog",
        description: "Public reads for Storefront and Search & Recommendations",
      },
      { name: "sellers", description: "Shop onboarding and details" },
      { name: "listings", description: "A seller's offers and images" },
      { name: "moderation", description: "Approving shops and offers" },
      {
        name: "sales",
        description: "Recorded sales and the hand-off to Accounting",
      },
    ],
    paths: {
      "/catalog/offers": {
        get: {
          tags: ["catalog"],
          operationId: "listCatalogOffers",
          summary: "All public offers, paged (catalog feed)",
          description: [
            "Every public offer, oldest change first (`updatedAt`, then `offerId`).",
            "",
            "- **Full load:** call without `updatedSince`, then follow `nextCursor` until it is null.",
            "- **Changes only:** pass the largest `updatedAt` you have seen as `updatedSince`.",
            "- Offers that stop being public drop out of the feed; repeat a full load from time to time.",
            "- `nextCursor` is opaque: send it back unchanged with the same `updatedSince`.",
          ].join("\n"),
          parameters: queryParams(catalogQuerySchema),
          responses: {
            ...success("One page of public offers.", ref("CatalogPage")),
            ...errors({ "400": [] }),
          },
        },
      },
      "/products/{productId}": {
        get: {
          tags: ["catalog"],
          operationId: "getProduct",
          summary: "A public offer by product ID, with the shop name",
          parameters: [
            pathParam("productId", "^prd_[a-z0-9]+$", "prd_3f2a9c01b4d5e6f7"),
          ],
          responses: {
            ...success("The product.", ref("Product")),
            ...errors({ "400": [], "404": ["PRODUCT_NOT_FOUND"] }),
          },
        },
      },
      "/offers": {
        get: {
          tags: ["listings", "moderation"],
          operationId: "listOffers",
          summary:
            "Offers in any status (own shop, or any shop for offer moderators)",
          description:
            "A seller must pass their own `sellerId`. Offer moderators may filter by `status` alone; `status=pending` is the moderation queue.",
          security: session,
          parameters: queryParams(listOffersQuerySchema),
          responses: {
            ...success("Offers, most recently changed first.", list("Offer")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
            }),
          },
        },
      },
      "/offers/{offerId}": {
        get: {
          tags: ["catalog"],
          operationId: "getOffer",
          summary: "A public offer",
          parameters: [OFFER],
          responses: {
            ...success("The offer.", ref("Offer")),
            ...errors({ "400": [], "404": ["OFFER_NOT_FOUND"] }),
          },
        },
        patch: {
          tags: ["listings"],
          operationId: "updateOffer",
          summary: "Change an offer (owner only)",
          description:
            "Send only the fields that change. Text, category, attributes, images, variation labels or images, and measurements send an active offer back to review; price and stock do not. Any edit of a rejected offer resubmits it. `variations` replaces the whole list: keep `variationId` for existing rows. Measurements can be cleared with `null`.",
          security: session,
          parameters: [OFFER],
          requestBody: body("UpdateOfferRequest"),
          responses: {
            ...success("The changed offer.", ref("Offer")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["OFFER_NOT_FOUND"],
              "409": ["OFFER_LOCKED", "SELLER_NOT_ALLOWED"],
            }),
          },
        },
      },
      "/offers/{offerId}/approve": {
        post: {
          tags: ["moderation"],
          operationId: "approveOffer",
          summary: "Approve a pending offer",
          description: "Permission `marketplace:moderate-offers`.",
          security: session,
          parameters: [OFFER],
          responses: {
            ...success("The offer, now `active`.", ref("Offer")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["OFFER_NOT_FOUND"],
              "409": ["INVALID_STATUS_CHANGE"],
            }),
          },
        },
      },
      "/offers/{offerId}/reject": {
        post: {
          tags: ["moderation"],
          operationId: "rejectOffer",
          summary: "Reject a pending offer with a reason the seller sees",
          description: "Permission `marketplace:moderate-offers`.",
          security: session,
          parameters: [OFFER],
          requestBody: body("RejectRequest"),
          responses: {
            ...success("The offer, now `rejected`.", ref("Offer")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["OFFER_NOT_FOUND"],
              "409": ["INVALID_STATUS_CHANGE"],
            }),
          },
        },
      },
      "/sellers": {
        get: {
          tags: ["moderation"],
          operationId: "listSellers",
          summary: "Shops with private details (moderation queue)",
          description: "Permission `marketplace:verify-sellers`. Newest first.",
          security: session,
          parameters: queryParams(listSellersQuerySchema),
          responses: {
            ...success("Shops.", list("SellerAccount")),
            ...errors({ "400": [], "401": [], "403": [] }),
          },
        },
        post: {
          tags: ["sellers"],
          operationId: "registerSeller",
          summary: "Open a shop for the signed-in user",
          description:
            "The shop starts `pending`. The owner is the session user. One current shop per user.",
          security: session,
          requestBody: body("RegisterSellerRequest"),
          responses: {
            ...success("The new shop.", ref("SellerAccount"), "201"),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "409": ["SELLER_EXISTS"],
            }),
          },
        },
      },
      "/sellers/me": {
        get: {
          tags: ["sellers"],
          operationId: "getMyShop",
          summary: "The signed-in user's shop",
          security: session,
          responses: {
            ...success("The current shop, or null.", ref("MyShop")),
            ...errors({ "401": [] }),
          },
        },
      },
      "/sellers/{sellerId}": {
        get: {
          tags: ["catalog"],
          operationId: "getSeller",
          summary: "A public (active) shop",
          parameters: [SELLER],
          responses: {
            ...success("The shop.", ref("Seller")),
            ...errors({ "400": [], "404": ["SELLER_NOT_FOUND"] }),
          },
        },
        patch: {
          tags: ["sellers"],
          operationId: "updateSeller",
          summary: "Change shop details (owner only)",
          security: session,
          parameters: [SELLER],
          requestBody: body("UpdateSellerRequest"),
          responses: {
            ...success("The changed shop.", ref("SellerAccount")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
              "409": ["SELLER_NOT_ALLOWED"],
            }),
          },
        },
      },
      "/sellers/{sellerId}/approve": {
        post: {
          tags: ["moderation"],
          operationId: "approveSeller",
          summary: "Approve a pending shop",
          description: "Permission `marketplace:verify-sellers`.",
          security: session,
          parameters: [SELLER],
          responses: {
            ...success("The shop, now `active`.", ref("SellerAccount")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
              "409": ["INVALID_STATUS_CHANGE"],
            }),
          },
        },
      },
      "/sellers/{sellerId}/reject": {
        post: {
          tags: ["moderation"],
          operationId: "rejectSeller",
          summary: "Reject a pending shop with a reason",
          description:
            "Permission `marketplace:verify-sellers`. The shop becomes `terminated`.",
          security: session,
          parameters: [SELLER],
          requestBody: body("RejectRequest"),
          responses: {
            ...success("The shop, now `terminated`.", ref("SellerAccount")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
              "409": ["INVALID_STATUS_CHANGE"],
            }),
          },
        },
      },
      "/sellers/{sellerId}/offers": {
        get: {
          tags: ["catalog"],
          operationId: "listSellerOffers",
          summary: "Public offers of one shop",
          parameters: [SELLER],
          responses: {
            ...success("Public offers by name.", list("Offer")),
            ...errors({ "400": [], "404": ["SELLER_NOT_FOUND"] }),
          },
        },
        post: {
          tags: ["listings"],
          operationId: "createOffer",
          summary: "List a new product (owner only)",
          description:
            "Upload the images first (`uploadListingImage`). Without variations send `priceMinor` and `stock`; with variations both come from the variations. The offer starts `pending`.",
          security: session,
          parameters: [SELLER],
          requestBody: body("CreateOfferRequest"),
          responses: {
            ...success("The new offer.", ref("Offer"), "201"),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
              "409": ["SELLER_NOT_ALLOWED"],
            }),
          },
        },
      },
      "/sellers/{sellerId}/images": {
        post: {
          tags: ["listings"],
          operationId: "uploadListingImage",
          summary: "Upload a listing image (owner only)",
          description:
            "JPG, PNG or WEBP, at most 5 MiB. Send the raw bytes, or multipart form field `file`.",
          security: session,
          parameters: [SELLER],
          requestBody: {
            required: true,
            content: {
              "image/jpeg": { schema: str({ format: "binary" }) },
              "image/png": { schema: str({ format: "binary" }) },
              "image/webp": { schema: str({ format: "binary" }) },
              "multipart/form-data": {
                schema: obj({ file: str({ format: "binary" }) }),
              },
            },
          },
          responses: {
            ...success("The stored image.", ref("UploadedImage"), "201"),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
              "409": ["SELLER_NOT_ALLOWED"],
              "413": [],
              "415": [],
            }),
          },
        },
      },
      "/images/{imageId}": {
        get: {
          tags: ["catalog"],
          operationId: "getListingImage",
          summary: "A listing image",
          description:
            "Public once a public offer uses it. Before that only for the shop owner and offer moderators; anyone else gets 404.",
          parameters: [
            pathParam(
              "imageId",
              "^img_[a-f0-9]{32}$",
              "img_0123456789abcdef0123456789abcdef",
            ),
          ],
          responses: {
            "200": {
              description: "The image bytes.",
              content: {
                "image/jpeg": { schema: str({ format: "binary" }) },
                "image/png": { schema: str({ format: "binary" }) },
                "image/webp": { schema: str({ format: "binary" }) },
              },
            },
            ...errors({ "400": [], "404": ["IMAGE_NOT_FOUND"] }),
          },
        },
      },
      "/sales": {
        get: {
          tags: ["sales"],
          operationId: "listSales",
          summary: "Sale lines, newest first",
          description:
            "With a session: only your own shop (`sellerId` required). With the service token (Accounting, the order owner): any filter. At least one filter.",
          security: sessionOrService,
          parameters: queryParams(listSalesQuerySchema),
          responses: {
            ...success("Sale lines.", list("SaleLine")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SELLER_NOT_FOUND"],
            }),
          },
        },
        post: {
          tags: ["sales"],
          operationId: "recordSale",
          summary: "Record a paid order line (order owner)",
          description:
            "The offer must be public and without variations. Decreases stock, records the current price, then sends the line to Accounting. If Accounting cannot be reached the sale still succeeds with `invoiceStatus: pending`.",
          security: service,
          requestBody: body("RecordSaleRequest"),
          responses: {
            ...success("The recorded sale line.", ref("SaleLine"), "201"),
            ...errors({
              "400": [],
              "401": [],
              "404": ["OFFER_NOT_FOUND"],
              "409": [
                "OFFER_NOT_AVAILABLE",
                "DUPLICATE_SALE",
                "INSUFFICIENT_STOCK",
              ],
            }),
          },
        },
      },
      "/sales/{saleId}/accounting-handoff": {
        post: {
          tags: ["sales"],
          operationId: "retryAccountingHandoff",
          summary: "Send a pending or refused sale to Accounting again",
          description: "The shop owner (session) or a service caller.",
          security: sessionOrService,
          parameters: [
            pathParam("saleId", "^sal_[a-z0-9]+$", "sal_3f2a9c01b4d5e6f7"),
          ],
          responses: {
            ...success("The sale line, now `invoiced`.", ref("SaleLine")),
            ...errors({
              "400": [],
              "401": [],
              "403": [],
              "404": ["SALE_NOT_FOUND"],
              "409": ["ALREADY_INVOICED", "INVOICE_REFUSED"],
              "503": [],
            }),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description:
            "Better Auth session cookie from signing in on this application.",
        },
        serviceToken: {
          type: "http",
          scheme: "bearer",
          description:
            "Interim service-to-service token (`MARKETPLACE_SERVICE_TOKEN`) until the class agrees service authentication.",
        },
      },
      schemas,
    },
  };
}
