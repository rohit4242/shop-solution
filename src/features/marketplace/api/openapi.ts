import { z } from "zod";
import {
  catalogQuerySchema,
  createOfferSchema,
  ENTITY_ID,
  IMAGE_KEY,
  listOffersQuerySchema,
  listSellersQuerySchema,
  registerSellerSchema,
  rejectSchema,
  updateOfferSchema,
  updateSellerSchema,
} from "../schemas/marketplace.schema";

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

const ID = ENTITY_ID.source;
const id = (description: string, example = "cm3k9x2ab0001qz8l4n7v5t2e") =>
  str({ pattern: ID, description, examples: [example] });
const imageKey = str({
  pattern: IMAGE_KEY.source,
  description: "`OfferImage.storageKey`. Send it back to keep the image.",
});

const schemas: Record<string, unknown> = {
  SellerStatus: str({ enum: ["pending", "active", "suspended", "terminated"] }),
  OfferStatus: str({
    enum: ["draft", "pending", "active", "rejected", "blocked", "removed"],
    description: "Moderation status. Public reads only return `active`.",
  }),
  ProductStatus: str({
    enum: ["draft", "active", "archived"],
    description:
      "Catalog status of the shared `Product`. A product a seller lists starts `draft` and becomes `active` when its first offer is approved.",
  }),
  OrderStatus: str({ enum: ["placed", "cancelled", "completed"] }),
  Availability: str({ enum: ["in_stock", "out_of_stock"] }),
  Address: obj({
    street: str(),
    postalCode: str(),
    city: str(),
    country: str({ pattern: "^[A-Z]{2}$", description: "ISO 3166-1 alpha-2" }),
  }),
  Seller: obj(
    {
      sellerId: id("`Seller.id`."),
      displayName: str({ examples: ["Anna's Ceramics"] }),
      status: ref("SellerStatus"),
      createdAt: dateTime,
    },
    { description: "Public view of a shop." },
  ),
  SellerAccount: {
    description:
      "A shop with private details. Only for its members and seller moderators.",
    allOf: [
      ref("Seller"),
      obj({
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
  Category: obj(
    { slug: str({ examples: ["home-kitchen"] }), name: str() },
    { description: "A category of the shared catalog (`Category`)." },
  ),
  ListingImage: obj({ imageKey, imageUrl: str() }),
  OfferItem: obj(
    {
      offerItemId: id("`OfferItem.id`: what carts and order lines reference."),
      productVariantId: id("`ProductVariant.id`."),
      variantCode: str({
        description: "`default` for a product without variations.",
      }),
      label: str({ examples: ["Blue / M"] }),
      priceMinor: int({ minimum: 1, description: "VAT-inclusive cents." }),
      currency: str({ examples: ["EUR"] }),
      stock: int({
        minimum: 0,
        description: "`InventoryBalance.onHand`.",
      }),
      available: int({
        minimum: 0,
        description: "`onHand − held`: what customers can still buy.",
      }),
      availability: ref("Availability"),
      images: {
        type: "array",
        items: ref("ListingImage"),
        description: "The item's own images, or the offer images.",
      },
      inheritsImages: { type: "boolean" },
    },
    { description: "A sellable item of an offer: one product variant." },
  ),
  Offer: obj(
    {
      offerId: id("`Offer.id`."),
      productId: id("`Product.id` of the shared catalog."),
      sellerId: id("`Seller.id`."),
      name: str({ examples: ["Stoneware mug"] }),
      description: str(),
      categorySlug: str(),
      attributes: { type: "object", additionalProperties: str() },
      hasVariations: {
        type: "boolean",
        description:
          "False when the only item is the product's `default` variant.",
      },
      items: {
        type: "array",
        minItems: 1,
        items: ref("OfferItem"),
        description: "Active items only.",
      },
      priceMinor: int({
        minimum: 1,
        description: "The cheapest item, VAT-inclusive cents.",
        examples: [1999],
      }),
      maximumPriceMinor: int({ minimum: 1 }),
      currency: str({ examples: ["EUR"] }),
      stock: int({ minimum: 0, description: "Sum of item stock." }),
      availability: ref("Availability"),
      images: {
        type: "array",
        items: ref("ListingImage"),
        description: "Paths on this application's origin, main image first.",
      },
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
    {
      description:
        "A shop's listing of a catalog product. Name, description, category and attributes come from the shared `Product`; measurements from its variants.",
    },
  ),
  ProductOffer: {
    allOf: [ref("Offer"), obj({ sellerDisplayName: str() })],
  },
  Product: obj(
    {
      productId: id("`Product.id`."),
      name: str(),
      description: str(),
      categorySlug: str(),
      attributes: { type: "object", additionalProperties: str() },
      status: ref("ProductStatus"),
      offers: {
        type: "array",
        items: ref("ProductOffer"),
        description: "Public offers for this product, cheapest first.",
      },
    },
    { description: "A catalog product and the shops that sell it." },
  ),
  CatalogPage: obj({
    items: { type: "array", items: ref("Offer") },
    nextCursor: nullable(
      str({
        description:
          "Pass as `cursor` for the next page. Null on the last page.",
      }),
    ),
  }),
  SaleLine: obj(
    {
      orderLineId: id("`OrderLine.id`."),
      orderId: str(),
      offerId: id("`Offer.id`."),
      offerItemId: id("`OfferItem.id`."),
      productName: str({ description: "Snapshot at purchase." }),
      variantLabel: str({ description: "Snapshot at purchase." }),
      quantity: int({ minimum: 1 }),
      unitPriceMinor: int({ description: "Unit price at purchase." }),
      totalMinor: int({ description: "`OrderLine.totalMinor`." }),
      currency: str(),
      placedAt: dateTime,
      orderStatus: ref("OrderStatus"),
      paid: {
        type: "boolean",
        description: "The order has a confirmed payment.",
      },
    },
    {
      description:
        "A purchased order line of this shop's offers, read from the canonical order tables.",
    },
  ),
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
  "401": "`UNAUTHENTICATED`: no session.",
  "403":
    "`FORBIDDEN`: missing permission, another seller's shop, or a request from another site.",
  "404": "The resource does not exist or is not public.",
  "409": "A business rule refused the change.",
  "413": "`IMAGE_TOO_LARGE`: more than 5 MiB.",
  "415": "`INVALID_IMAGE`: not a JPG, PNG or WEBP image.",
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
const SELLER = pathParam("sellerId", ID, "cm3k9x2ab0001qz8l4n7v5t2e");
const OFFER = pathParam("offerId", ID, "cm3k9x2ab0002qz8l9c1d3f4g");

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

export function createMarketplaceOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Marketplace API",
      version: MARKETPLACE_API_VERSION,
      summary:
        "Seller onboarding, listings with moderation, the public offer catalog, and each shop's sales.",
      description: [
        "Owned by the Marketplace team. Contract and rules: `src/features/marketplace/README.md`.",
        "",
        '- Success bodies are `{ "data": ... }`; failures are `{ "error": { code, message, fieldErrors? } }`.',
        "- Money is integer minor units, VAT included: `1999` = EUR 19.99. Only `EUR` for now.",
        "- Timestamps are ISO 8601 UTC. IDs are the canonical shop IDs (`cuid`).",
        "- Reads and writes use the shared shop tables: `Seller`, `SellerMember`, `Product`, `ProductVariant`, `Offer`, `OfferItem`, `InventoryBalance`, `OfferImage` and, read-only, `Category` and `OrderLine`.",
        "- An offer is public only when the offer, its shop and its product are `active`.",
        "",
        "In-app features call the same operations directly from `@/features/marketplace/server`.",
        "",
        "3.0.0 moves the 2.2.0 API (FastAPI) into the shared Next.js app on the canonical shop schema:",
        "routes under `/api/v1/marketplace`, the `{ data }` envelope, 400 instead of 422 for validation errors,",
        "Better Auth sessions, canonical IDs without prefixes, `categorySlug` from the shared catalog,",
        "`items` (offer items) instead of `variations`, image keys instead of image IDs, and sales derived",
        "from order lines (`GET /sellers/{sellerId}/sales`). Marketplace no longer records sales or",
        "calls Accounting.",
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
      { name: "sales", description: "A shop's purchased order lines" },
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
      "/categories": {
        get: {
          tags: ["catalog"],
          operationId: "listCategories",
          summary: "Categories of the shared catalog",
          description:
            "Read-only. Marketplace does not create categories; `categorySlug` in a listing must be one of these.",
          responses: {
            ...success("Categories by name.", list("Category")),
          },
        },
      },
      "/products/{productId}": {
        get: {
          tags: ["catalog"],
          operationId: "getProduct",
          summary: "An active catalog product with its public offers",
          parameters: [pathParam("productId", ID, "cm3k9x2ab0003qz8lh6j8k0m1")],
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
            "Send only the fields that change. Text, category, attributes, images, which variations exist, their labels or images, and measurements send an active offer back to review; price and stock do not. Any edit of a rejected offer resubmits it. `variations` replaces the whole list: keep `offerItemId` for existing rows; removed items are deactivated, not deleted, so order history keeps them. `variations: []` turns variations off and needs `priceMinor` and `stock`. Product facts can only change while no other shop sells the product. Measurements can be cleared with `null`.",
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
              "409": [
                "OFFER_LOCKED",
                "SELLER_NOT_ALLOWED",
                "PRODUCT_SHARED",
                "STOCK_BELOW_HELD",
                "IMAGE_IN_USE",
                "CONCURRENT_UPDATE",
              ],
            }),
          },
        },
      },
      "/offers/{offerId}/approve": {
        post: {
          tags: ["moderation"],
          operationId: "approveOffer",
          summary: "Approve a pending offer",
          description:
            "Permission `marketplace:moderate-offers`. Also activates the offer's product when it is still `draft`.",
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
            "The shop starts `pending`. The session user becomes its `SellerMember` with role `owner`. One current shop per user.",
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
          summary: "Public offers of one active shop",
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
            "Upload the images first (`uploadListingImage`). Creates a `draft` catalog product with its variants, the shop's `pending` offer, one offer item and stock balance per variant, and the image rows. Without variations send `priceMinor` and `stock` (one `default` variant); with variations each has its own. `categorySlug` must exist in `listCategories`.",
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
              "409": ["SELLER_NOT_ALLOWED", "IMAGE_IN_USE"],
            }),
          },
        },
      },
      "/sellers/{sellerId}/sales": {
        get: {
          tags: ["sales"],
          operationId: "listSales",
          summary: "The shop's purchased order lines, newest first",
          description:
            "Shop members only. Read from `OrderLine` joined to this shop's offer items. Marketplace does not record sales; the checkout owner writes orders.",
          security: session,
          parameters: [SELLER],
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
      },
      "/sellers/{sellerId}/images": {
        post: {
          tags: ["listings"],
          operationId: "uploadListingImage",
          summary: "Upload a listing image (owner only)",
          description:
            "JPG, PNG or WEBP, at most 5 MiB. Send the raw bytes, or multipart form field `file`. Returns an image key to use in `createOffer` or `updateOffer`.",
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
            ...success("The stored image.", ref("ListingImage"), "201"),
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
      "/images/{imageKey}": {
        get: {
          tags: ["catalog"],
          operationId: "getListingImage",
          summary: "A listing image",
          description:
            "Public once a public offer uses it. Otherwise only for members of its shop and, once attached to an offer, offer moderators; anyone else gets 404.",
          parameters: [
            pathParam(
              "imageKey",
              IMAGE_KEY.source,
              "mkt_cm3k9x2ab0001qz8l4n7v5t2e_0123456789abcdef0123456789abcdef",
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
      },
      schemas,
    },
  };
}
