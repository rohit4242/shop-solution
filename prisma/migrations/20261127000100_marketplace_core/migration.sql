-- CreateEnum
CREATE TYPE "MarketplaceSellerStatus" AS ENUM ('pending', 'active', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "MarketplaceOfferStatus" AS ENUM ('draft', 'pending', 'active', 'rejected', 'blocked', 'removed');

-- CreateEnum
CREATE TYPE "MarketplaceCategory" AS ENUM ('electronics', 'clothing', 'shoes', 'home_kitchen', 'sports_outdoors', 'beauty_personal_care', 'books_stationery', 'toys_games', 'other');

-- CreateEnum
CREATE TYPE "MarketplaceInvoiceStatus" AS ENUM ('pending', 'invoiced', 'refused');

-- CreateTable
CREATE TABLE "marketplace_seller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "legalName" VARCHAR(100) NOT NULL,
    "contactEmail" VARCHAR(120) NOT NULL,
    "addressStreet" VARCHAR(100) NOT NULL,
    "addressPostalCode" VARCHAR(12) NOT NULL,
    "addressCity" VARCHAR(60) NOT NULL,
    "addressCountry" CHAR(2) NOT NULL,
    "status" "MarketplaceSellerStatus" NOT NULL DEFAULT 'pending',
    "statusReason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_offer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "category" "MarketplaceCategory" NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "priceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "stock" INTEGER NOT NULL,
    "imageIds" TEXT[],
    "lengthCm" DOUBLE PRECISION,
    "widthCm" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "weightGrams" DOUBLE PRECISION,
    "status" "MarketplaceOfferStatus" NOT NULL DEFAULT 'pending',
    "statusReason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_offer_variation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "imageIds" TEXT[],

    CONSTRAINT "marketplace_offer_variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_image" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "mediaType" VARCHAR(32) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_sale_line" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceStatus" "MarketplaceInvoiceStatus" NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "invoiceError" TEXT,

    CONSTRAINT "marketplace_sale_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_seller_userId_idx" ON "marketplace_seller"("userId");

-- CreateIndex
CREATE INDEX "marketplace_seller_status_idx" ON "marketplace_seller"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_offer_productId_key" ON "marketplace_offer"("productId");

-- CreateIndex
CREATE INDEX "marketplace_offer_sellerId_status_idx" ON "marketplace_offer"("sellerId", "status");

-- CreateIndex
CREATE INDEX "marketplace_offer_status_updatedAt_id_idx" ON "marketplace_offer"("status", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_offer_variation_offerId_position_key" ON "marketplace_offer_variation"("offerId", "position");

-- CreateIndex
CREATE INDEX "marketplace_listing_image_sellerId_idx" ON "marketplace_listing_image"("sellerId");

-- CreateIndex
CREATE INDEX "marketplace_sale_line_sellerId_soldAt_idx" ON "marketplace_sale_line"("sellerId", "soldAt");

-- CreateIndex
CREATE INDEX "marketplace_sale_line_invoiceStatus_idx" ON "marketplace_sale_line"("invoiceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_sale_line_orderId_offerId_key" ON "marketplace_sale_line"("orderId", "offerId");

-- AddForeignKey
ALTER TABLE "marketplace_offer" ADD CONSTRAINT "marketplace_offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace_seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_offer_variation" ADD CONSTRAINT "marketplace_offer_variation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "marketplace_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_image" ADD CONSTRAINT "marketplace_listing_image_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace_seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_sale_line" ADD CONSTRAINT "marketplace_sale_line_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "marketplace_offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_sale_line" ADD CONSTRAINT "marketplace_sale_line_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace_seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Value rules (hand-written: Prisma cannot express CHECK constraints).
-- The services validate the same rules with Zod; these keep bad rows out of the table.
ALTER TABLE "marketplace_seller"
    ADD CONSTRAINT "marketplace_seller_addressCountry_check" CHECK ("addressCountry" ~ '^[A-Z]{2}$');

ALTER TABLE "marketplace_offer"
    ADD CONSTRAINT "marketplace_offer_priceMinor_check" CHECK ("priceMinor" BETWEEN 1 AND 10000000),
    ADD CONSTRAINT "marketplace_offer_stock_check" CHECK ("stock" BETWEEN 0 AND 100000),
    ADD CONSTRAINT "marketplace_offer_currency_check" CHECK ("currency" = 'EUR'),
    ADD CONSTRAINT "marketplace_offer_imageIds_check" CHECK (cardinality("imageIds") <= 10),
    ADD CONSTRAINT "marketplace_offer_measurements_check" CHECK (
        ("lengthCm" IS NULL OR "lengthCm" > 0) AND ("widthCm" IS NULL OR "widthCm" > 0) AND
        ("heightCm" IS NULL OR "heightCm" > 0) AND ("weightGrams" IS NULL OR "weightGrams" > 0));

ALTER TABLE "marketplace_offer_variation"
    ADD CONSTRAINT "marketplace_offer_variation_priceMinor_check" CHECK ("priceMinor" BETWEEN 1 AND 10000000),
    ADD CONSTRAINT "marketplace_offer_variation_stock_check" CHECK ("stock" BETWEEN 0 AND 100000),
    ADD CONSTRAINT "marketplace_offer_variation_imageIds_check" CHECK (cardinality("imageIds") <= 10);

ALTER TABLE "marketplace_sale_line"
    ADD CONSTRAINT "marketplace_sale_line_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100),
    ADD CONSTRAINT "marketplace_sale_line_unitPriceMinor_check" CHECK ("unitPriceMinor" >= 1),
    ADD CONSTRAINT "marketplace_sale_line_currency_check" CHECK ("currency" = 'EUR');
ALTER TABLE "marketplace_listing_image" ADD CONSTRAINT "marketplace_listing_image_byteSize_check" CHECK ("byteSize" BETWEEN 1 AND 5242880 AND "byteSize" = octet_length("data"));
