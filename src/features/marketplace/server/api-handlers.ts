import "server-only";
import {
  catalogQuerySchema,
  createOfferSchema,
  imageKeySchema,
  listOffersQuerySchema,
  listSellersQuerySchema,
  MAX_IMAGE_BYTES,
  offerIdSchema,
  productIdSchema,
  registerSellerSchema,
  rejectSchema,
  sellerIdSchema,
  updateOfferSchema,
  updateSellerSchema,
} from "../schemas/marketplace.schema";
import { MarketplaceError } from "./errors";
import {
  actorOf,
  jsonBody,
  signedInActorOf,
  ok,
  param,
  queryOf,
  route,
  type RouteContext,
} from "./http";
import * as images from "./services/images";
import * as offers from "./services/offers";
import * as sales from "./services/sales";
import * as sellers from "./services/sellers";
import { stringify } from "yaml";
import { createMarketplaceOpenApi } from "../api/openapi";

// One handler per route in api/openapi.yaml. src/app/api/v1/marketplace/** re-exports these.

type Ctx<P extends string> = RouteContext<P>;

async function readUpload(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES)
    throw new MarketplaceError(
      413,
      "IMAGE_TOO_LARGE",
      "Images must be at most 5 MiB.",
    );
  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof Blob))
      throw new MarketplaceError(
        415,
        "INVALID_IMAGE",
        'Send the image as form field "file".',
      );
    if (file.size > MAX_IMAGE_BYTES)
      throw new MarketplaceError(
        413,
        "IMAGE_TOO_LARGE",
        "Images must be at most 5 MiB.",
      );
    return new Uint8Array(await file.arrayBuffer());
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new MarketplaceError(
      413,
      "IMAGE_TOO_LARGE",
      "Images must be at most 5 MiB.",
    );
  return bytes;
}

export const marketplaceRoutes = {
  catalogOffers: {
    GET: route(async (request) =>
      ok(await offers.listCatalogOffers(queryOf(request, catalogQuerySchema))),
    ),
  },
  categories: {
    GET: route(async () => ok(await offers.listCategories())),
  },
  product: {
    GET: route(async (_request, { params }: Ctx<"productId">) =>
      ok(
        await offers.getProduct(
          param(productIdSchema, (await params).productId),
        ),
      ),
    ),
  },
  offers: {
    GET: route(async (request) =>
      ok(
        await offers.listOffers(
          await actorOf(request),
          queryOf(request, listOffersQuerySchema),
        ),
      ),
    ),
  },
  offer: {
    GET: route(async (_request, { params }: Ctx<"offerId">) =>
      ok(await offers.getOffer(param(offerIdSchema, (await params).offerId))),
    ),
    PATCH: route(async (request, { params }: Ctx<"offerId">) => {
      const offerId = param(offerIdSchema, (await params).offerId);
      const actor = await signedInActorOf(request);
      return ok(
        await offers.updateOffer(
          actor,
          offerId,
          await jsonBody(request, updateOfferSchema),
        ),
      );
    }),
  },
  approveOffer: {
    POST: route(async (request, { params }: Ctx<"offerId">) =>
      ok(
        await offers.approveOffer(
          await actorOf(request),
          param(offerIdSchema, (await params).offerId),
        ),
      ),
    ),
  },
  rejectOffer: {
    POST: route(async (request, { params }: Ctx<"offerId">) => {
      const offerId = param(offerIdSchema, (await params).offerId);
      const actor = await signedInActorOf(request);
      const { reason } = await jsonBody(request, rejectSchema);
      return ok(await offers.rejectOffer(actor, offerId, reason));
    }),
  },
  sellers: {
    GET: route(async (request) =>
      ok(
        await sellers.listSellers(
          await actorOf(request),
          queryOf(request, listSellersQuerySchema).status,
        ),
      ),
    ),
    POST: route(async (request) => {
      const actor = await signedInActorOf(request);
      return ok(
        await sellers.registerSeller(
          actor,
          await jsonBody(request, registerSellerSchema),
        ),
        201,
      );
    }),
  },
  mySeller: {
    GET: route(async (request) =>
      ok(await sellers.getMyShop(await actorOf(request))),
    ),
  },
  seller: {
    GET: route(async (_request, { params }: Ctx<"sellerId">) =>
      ok(
        await sellers.getSeller(param(sellerIdSchema, (await params).sellerId)),
      ),
    ),
    PATCH: route(async (request, { params }: Ctx<"sellerId">) => {
      const sellerId = param(sellerIdSchema, (await params).sellerId);
      const actor = await signedInActorOf(request);
      return ok(
        await sellers.updateSeller(
          actor,
          sellerId,
          await jsonBody(request, updateSellerSchema),
        ),
      );
    }),
  },
  approveSeller: {
    POST: route(async (request, { params }: Ctx<"sellerId">) =>
      ok(
        await sellers.approveSeller(
          await actorOf(request),
          param(sellerIdSchema, (await params).sellerId),
        ),
      ),
    ),
  },
  rejectSeller: {
    POST: route(async (request, { params }: Ctx<"sellerId">) => {
      const sellerId = param(sellerIdSchema, (await params).sellerId);
      const actor = await signedInActorOf(request);
      const { reason } = await jsonBody(request, rejectSchema);
      return ok(await sellers.rejectSeller(actor, sellerId, reason));
    }),
  },
  sellerOffers: {
    GET: route(async (_request, { params }: Ctx<"sellerId">) =>
      ok(
        await offers.listSellerOffers(
          param(sellerIdSchema, (await params).sellerId),
        ),
      ),
    ),
    POST: route(async (request, { params }: Ctx<"sellerId">) => {
      const sellerId = param(sellerIdSchema, (await params).sellerId);
      const actor = await signedInActorOf(request);
      return ok(
        await offers.createOffer(
          actor,
          sellerId,
          await jsonBody(request, createOfferSchema),
        ),
        201,
      );
    }),
  },
  sellerImages: {
    POST: route(async (request, { params }: Ctx<"sellerId">) => {
      const sellerId = param(sellerIdSchema, (await params).sellerId);
      const actor = await signedInActorOf(request);
      return ok(
        await images.uploadListingImage(
          actor,
          sellerId,
          await readUpload(request),
        ),
        201,
      );
    }),
  },
  image: {
    GET: route(async (request, { params }: Ctx<"imageKey">) => {
      const imageKey = param(imageKeySchema, (await params).imageKey);
      const image = await images.getListingImage(
        await actorOf(request),
        imageKey,
      );
      return new Response(Buffer.from(image.bytes), {
        headers: {
          "Content-Type": image.mediaType,
          "Cache-Control": image.isPublic
            ? "public, max-age=300"
            : "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  },
  sellerSales: {
    GET: route(async (request, { params }: Ctx<"sellerId">) => {
      const sellerId = param(sellerIdSchema, (await params).sellerId);
      return ok(await sales.listSales(await actorOf(request), sellerId));
    }),
  },
  openapi: {
    GET: route(async (request) => {
      const document = createMarketplaceOpenApi();
      const cache = { "Cache-Control": "public, max-age=300" };
      if (new URL(request.url).pathname.endsWith(".json"))
        return Response.json(document, { headers: cache });
      return new Response(stringify(document), {
        headers: {
          "Content-Type": "application/yaml; charset=utf-8",
          ...cache,
        },
      });
    }),
  },
};
