-- CreateEnum
CREATE TYPE "marketing_discount_type" AS ENUM ('percent', 'fixed', 'free_shipping');

-- CreateEnum
CREATE TYPE "marketing_record_status" AS ENUM ('active', 'reversed');

-- CreateEnum
CREATE TYPE "marketing_discount_source" AS ENUM ('code', 'promotion');

-- CreateTable
CREATE TABLE "marketing_promotion" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "marketing_discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_discount_code" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "marketing_discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "minOrderTotal" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "campaignId" UUID,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_discount_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_redemption" (
    "id" UUID NOT NULL,
    "codeId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "discountTotal" DECIMAL(10,2) NOT NULL,
    "status" "marketing_record_status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_order_discount" (
    "id" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "appliedBy" "marketing_discount_source" NOT NULL,
    "codeId" UUID,
    "code" TEXT,
    "promotionId" UUID,
    "currency" TEXT NOT NULL,
    "discountTotal" DECIMAL(10,2) NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_order_discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_received_event" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_received_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_promotion_active_validFrom_idx" ON "marketing_promotion"("active", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_discount_code_code_key" ON "marketing_discount_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_redemption_codeId_orderId_key" ON "marketing_redemption"("codeId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_order_discount_orderId_key" ON "marketing_order_discount"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_received_event_source_eventId_key" ON "marketing_received_event"("source", "eventId");

-- AddForeignKey
ALTER TABLE "marketing_redemption" ADD CONSTRAINT "marketing_redemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "marketing_discount_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Codes are stored uppercase, so the unique index is case-insensitive in practice.
ALTER TABLE "marketing_discount_code" ADD CONSTRAINT "marketing_discount_code_uppercase" CHECK ("code" = UPPER("code"));
