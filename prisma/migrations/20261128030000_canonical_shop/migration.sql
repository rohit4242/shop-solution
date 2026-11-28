BEGIN;

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'REJECTED', 'BLOCKED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'LABEL_CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,

    CONSTRAINT "customer_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "outcomeCode" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "customer_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment_member" (
    "customerId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segment_member_pkey" PRIMARY KEY ("customerId","segmentId")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "lengthCm" DOUBLE PRECISION,
    "widthCm" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "weightGrams" DOUBLE PRECISION,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_member" (
    "sellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "seller_member_pkey" PRIMARY KEY ("sellerId","userId")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_item" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "offer_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_image" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerItemId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "altText" TEXT,

    CONSTRAINT "offer_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balance" (
    "offerItemId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balance_pkey" PRIMARY KEY ("offerItemId")
);

-- CreateTable
CREATE TABLE "inventory_reservation" (
    "orderLineId" TEXT NOT NULL,
    "offerItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservation_pkey" PRIMARY KEY ("orderLineId")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item" (
    "cartId" TEXT NOT NULL,
    "offerItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("cartId","offerItemId")
);

-- CreateTable
CREATE TABLE "shop_order" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "currency" CHAR(3) NOT NULL,
    "itemsSubtotalMinor" INTEGER NOT NULL,
    "shippingMinor" INTEGER NOT NULL,
    "discountTotalMinor" INTEGER NOT NULL,
    "taxTotalMinor" INTEGER NOT NULL,
    "grandTotalMinor" INTEGER NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_address" (
    "orderId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,

    CONSTRAINT "order_address_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "offerItemId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "sellerDisplayName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "taxRateBasisPoints" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "reason" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "grossMinor" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "invoiceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "orderLineId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "taxRateBasisPoints" INTEGER NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "grossMinor" INTEGER NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("invoiceId","lineNumber")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_consent" (
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "marketing_consent_pkey" PRIMARY KEY ("customerId","channel")
);

-- CreateTable
CREATE TABLE "promotion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "percentBasisPoints" INTEGER,
    "fixedMinor" INTEGER,
    "currency" CHAR(3),
    "automatic" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_product" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "promotion_product_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateTable
CREATE TABLE "promotion_category" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "promotion_category_pkey" PRIMARY KEY ("promotionId","categoryId")
);

-- CreateTable
CREATE TABLE "discount_code" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "minOrderTotalMinor" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "discount_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_discount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "codeId" TEXT,
    "label" TEXT NOT NULL,
    "appliedMinor" INTEGER NOT NULL,
    "shippingMinor" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "order_discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_discount_allocation" (
    "discountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "order_discount_allocation_pkey" PRIMARY KEY ("discountId","orderLineId")
);

-- CreateTable
CREATE TABLE "shipping_method" (
    "id" TEXT NOT NULL,
    "carrierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minDeliveryDays" INTEGER NOT NULL,
    "maxDeliveryDays" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "carrierCode" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "paymentReference" TEXT,
    "status" "ShipmentStatus" NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_event" (
    "shipmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "previousStatus" "ShipmentStatus",
    "status" "ShipmentStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "observationKey" TEXT,
    "attemptCount" INTEGER NOT NULL,

    CONSTRAINT "shipment_event_pkey" PRIMARY KEY ("shipmentId","sequence")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event_delivery" (
    "eventId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,

    CONSTRAINT "order_event_delivery_pkey" PRIMARY KEY ("eventId","destination")
);

-- CreateTable
CREATE TABLE "event_receipt" (
    "consumer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_receipt_pkey" PRIMARY KEY ("consumer","source","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_userId_key" ON "customer"("userId");

-- CreateIndex
CREATE INDEX "customer_address_customerId_idx" ON "customer_address"("customerId");

-- CreateIndex
CREATE INDEX "customer_contact_customerId_occurredAt_idx" ON "customer_contact"("customerId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segment_name_key" ON "customer_segment"("name");

-- CreateIndex
CREATE INDEX "customer_segment_member_segmentId_idx" ON "customer_segment_member"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parentId_idx" ON "category"("parentId");

-- CreateIndex
CREATE INDEX "product_categoryId_status_idx" ON "product"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_productId_code_key" ON "product_variant"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_id_productId_key" ON "product_variant"("id", "productId");

-- CreateIndex
CREATE INDEX "seller_status_idx" ON "seller"("status");

-- CreateIndex
CREATE INDEX "seller_member_userId_idx" ON "seller_member"("userId");

-- CreateIndex
CREATE INDEX "offer_status_updatedAt_id_idx" ON "offer"("status", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_sellerId_productId_key" ON "offer"("sellerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_id_productId_key" ON "offer"("id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_item_offerId_productVariantId_key" ON "offer_item"("offerId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_item_id_offerId_key" ON "offer_item"("id", "offerId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_image_storageKey_key" ON "offer_image"("storageKey");

-- CreateIndex
CREATE INDEX "offer_image_offerId_offerItemId_position_idx" ON "offer_image"("offerId", "offerItemId", "position");

-- CreateIndex
CREATE INDEX "inventory_reservation_status_expiresAt_idx" ON "inventory_reservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_orderLineId_offerItemId_key" ON "inventory_reservation"("orderLineId", "offerItemId");

-- CreateIndex
CREATE INDEX "cart_customerId_updatedAt_idx" ON "cart"("customerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cart_id_customerId_key" ON "cart"("id", "customerId");

-- CreateIndex
CREATE INDEX "cart_item_offerItemId_idx" ON "cart_item"("offerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_order_cartId_key" ON "shop_order"("cartId");

-- CreateIndex
CREATE INDEX "shop_order_customerId_placedAt_idx" ON "shop_order"("customerId", "placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shop_order_cartId_customerId_key" ON "shop_order"("cartId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_order_id_shippingMethodId_key" ON "shop_order"("id", "shippingMethodId");

-- CreateIndex
CREATE INDEX "order_line_orderId_idx" ON "order_line"("orderId");

-- CreateIndex
CREATE INDEX "order_line_offerItemId_idx" ON "order_line"("offerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_id_offerItemId_key" ON "order_line"("id", "offerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_id_orderId_key" ON "order_line"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operationKey_key" ON "payment"("operationKey");

-- CreateIndex
CREATE INDEX "payment_orderId_status_idx" ON "payment"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_providerReference_key" ON "payment"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "refund_operationKey_key" ON "refund"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "refund_paymentId_providerReference_key" ON "refund"("paymentId", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_orderId_key" ON "invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_id_orderId_key" ON "invoice"("id", "orderId");

-- CreateIndex
CREATE INDEX "promotion_active_startsAt_idx" ON "promotion"("active", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "discount_code_code_key" ON "discount_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "discount_code_id_promotionId_key" ON "discount_code"("id", "promotionId");

-- CreateIndex
CREATE INDEX "order_discount_codeId_idx" ON "order_discount"("codeId");

-- CreateIndex
CREATE UNIQUE INDEX "order_discount_orderId_promotionId_key" ON "order_discount"("orderId", "promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "order_discount_id_orderId_key" ON "order_discount"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_orderId_key" ON "shipment"("orderId");

-- CreateIndex
CREATE INDEX "shipment_status_updatedAt_idx" ON "shipment"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_orderId_shippingMethodId_key" ON "shipment"("orderId", "shippingMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_carrierCode_trackingNumber_key" ON "shipment"("carrierCode", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_event_shipmentId_observationKey_key" ON "shipment_event"("shipmentId", "observationKey");

-- CreateIndex
CREATE UNIQUE INDEX "review_orderLineId_key" ON "review"("orderLineId");

-- CreateIndex
CREATE INDEX "review_status_createdAt_idx" ON "review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_event_orderId_type_key" ON "order_event"("orderId", "type");

-- CreateIndex
CREATE INDEX "order_event_delivery_deliveredAt_nextAttemptAt_idx" ON "order_event_delivery"("deliveredAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contact" ADD CONSTRAINT "customer_contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_member" ADD CONSTRAINT "customer_segment_member_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_member" ADD CONSTRAINT "customer_segment_member_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_member" ADD CONSTRAINT "seller_member_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_member" ADD CONSTRAINT "seller_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_item" ADD CONSTRAINT "offer_item_offerId_productId_fkey" FOREIGN KEY ("offerId", "productId") REFERENCES "offer"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_item" ADD CONSTRAINT "offer_item_productVariantId_productId_fkey" FOREIGN KEY ("productVariantId", "productId") REFERENCES "product_variant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_image" ADD CONSTRAINT "offer_image_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_image" ADD CONSTRAINT "offer_image_offerItemId_offerId_fkey" FOREIGN KEY ("offerItemId", "offerId") REFERENCES "offer_item"("id", "offerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_offerItemId_fkey" FOREIGN KEY ("offerItemId") REFERENCES "offer_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_orderLineId_offerItemId_fkey" FOREIGN KEY ("orderLineId", "offerItemId") REFERENCES "order_line"("id", "offerItemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_offerItemId_fkey" FOREIGN KEY ("offerItemId") REFERENCES "inventory_balance"("offerItemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_offerItemId_fkey" FOREIGN KEY ("offerItemId") REFERENCES "offer_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_cartId_customerId_fkey" FOREIGN KEY ("cartId", "customerId") REFERENCES "cart"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_offerItemId_fkey" FOREIGN KEY ("offerItemId") REFERENCES "offer_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_orderId_fkey" FOREIGN KEY ("invoiceId", "orderId") REFERENCES "invoice"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_orderLineId_orderId_fkey" FOREIGN KEY ("orderLineId", "orderId") REFERENCES "order_line"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_consent" ADD CONSTRAINT "marketing_consent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_product" ADD CONSTRAINT "promotion_product_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_product" ADD CONSTRAINT "promotion_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_category" ADD CONSTRAINT "promotion_category_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_category" ADD CONSTRAINT "promotion_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code" ADD CONSTRAINT "discount_code_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discount" ADD CONSTRAINT "order_discount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discount" ADD CONSTRAINT "order_discount_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discount" ADD CONSTRAINT "order_discount_codeId_promotionId_fkey" FOREIGN KEY ("codeId", "promotionId") REFERENCES "discount_code"("id", "promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discount_allocation" ADD CONSTRAINT "order_discount_allocation_discountId_orderId_fkey" FOREIGN KEY ("discountId", "orderId") REFERENCES "order_discount"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discount_allocation" ADD CONSTRAINT "order_discount_allocation_orderLineId_orderId_fkey" FOREIGN KEY ("orderLineId", "orderId") REFERENCES "order_line"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_orderId_shippingMethodId_fkey" FOREIGN KEY ("orderId", "shippingMethodId") REFERENCES "shop_order"("id", "shippingMethodId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_event" ADD CONSTRAINT "shipment_event_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event_delivery" ADD CONSTRAINT "order_event_delivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "order_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve stock and order invariants at the database boundary.
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_valid_quantity"
    CHECK ("onHand" >= 0 AND "held" BETWEEN 0 AND "onHand");
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_positive_quantity"
    CHECK ("quantity" > 0);
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_positive_quantity"
    CHECK ("quantity" > 0);
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_positive_quantity"
    CHECK ("quantity" > 0);
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_valid_totals"
    CHECK (
        "itemsSubtotalMinor" >= 0 AND "shippingMinor" >= 0
        AND "discountTotalMinor" >= 0 AND "grandTotalMinor" >= 0
        AND "taxTotalMinor" BETWEEN 0 AND "grandTotalMinor"
        AND "grandTotalMinor" = "itemsSubtotalMinor"::bigint + "shippingMinor" - "discountTotalMinor"
    );
ALTER TABLE "review" ADD CONSTRAINT "review_rating_range"
    CHECK ("rating" BETWEEN 1 AND 5);

COMMIT;
