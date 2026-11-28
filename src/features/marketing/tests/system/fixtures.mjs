// Stand-ins for modules that are not in shop-solution yet, written straight into the shared shop tables
// of a DISPOSABLE local database (prisma/schema.prisma). Used only by the Marketing system test.
//
//   catalog(customerEmail)  products M1 (EUR 59.90) and M2 (EUR 20.00), each with a default variant and one
//                           seller offer, plus a customer for the logged-in test user. Idempotent.
//   placeOrder(id, lines, validateResult)
//                           what Storefront's checkout is meant to do: the order, its lines, and, when
//                           validate applied a discount, one order_discount row with per-line allocations,
//                           converted exactly from validate's decimals to minor units.
//   removeOrders()          deletes the orders this run created (so reset can remove the promotion).
//
// Never point DATABASE_URL at a shared environment.
import pg from "pg";

const PRODUCTS = {
  M1: { name: "M1", priceMinor: 5990 },
  M2: { name: "M2", priceMinor: 2000 },
};
const toMinor = (value) => Math.round(Number(value) * 100);

export async function createFixtures(databaseUrl, run) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const orders = [];
  let customerId;

  async function catalog(customerEmail) {
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO category (id, slug, name) VALUES ('cat-story', 'story-fixtures', 'Story fixtures')
         ON CONFLICT (id) DO NOTHING`,
      );
      await client.query(
        `INSERT INTO seller (id, "displayName", "legalName", "contactEmail", street, "postalCode", city, country, status, "updatedAt")
         VALUES ('seller-story', 'Story seller', 'Story seller GmbH', 'seller@shop.test', 'Teststr. 1', '94469', 'Deggendorf', 'DE', 'ACTIVE', now())
         ON CONFLICT (id) DO NOTHING`,
      );
      for (const [id, product] of Object.entries(PRODUCTS)) {
        await client.query(
          `INSERT INTO product (id, "categoryId", name, description, status, "updatedAt")
           VALUES ($1, 'cat-story', $2, 'Story test product', 'ACTIVE', now()) ON CONFLICT (id) DO NOTHING`,
          [id, product.name],
        );
        await client.query(
          `INSERT INTO product_variant (id, "productId", code, label) VALUES ($1, $2, 'default', 'Default')
           ON CONFLICT (id) DO NOTHING`,
          [`${id}-default`, id],
        );
        await client.query(
          `INSERT INTO offer (id, "productId", "sellerId", status, "updatedAt") VALUES ($1, $2, 'seller-story', 'ACTIVE', now())
           ON CONFLICT (id) DO NOTHING`,
          [`offer-${id}`, id],
        );
        await client.query(
          `INSERT INTO offer_item (id, "offerId", "productId", "productVariantId", "priceMinor", currency)
           VALUES ($1, $2, $3, $4, $5, 'EUR') ON CONFLICT (id) DO NOTHING`,
          [`oi-${id}`, `offer-${id}`, id, `${id}-default`, product.priceMinor],
        );
      }
      await client.query(
        `INSERT INTO shipping_method (id, "carrierCode", name, "minDeliveryDays", "maxDeliveryDays", "priceMinor", currency)
         VALUES ('ship-story', 'story', 'Story shipping', 1, 3, 0, 'EUR') ON CONFLICT (id) DO NOTHING`,
      );
      const user = await client.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [customerEmail],
      );
      if (!user.rows[0])
        throw new Error(`no user ${customerEmail}; log in first`);
      const customer = await client.query(
        `INSERT INTO customer (id, "userId", "updatedAt") VALUES ($1, $2, now())
         ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = now() RETURNING id`,
        [`customer-${user.rows[0].id}`, user.rows[0].id],
      );
      customerId = customer.rows[0].id;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  async function placeOrder(orderId, lines, validateResult) {
    const priced = lines.map((line, index) => ({
      ...line,
      lineId: `${orderId}-line-${index + 1}`,
      totalMinor: PRODUCTS[line.product].priceMinor * line.quantity,
    }));
    const subtotal = priced.reduce((sum, line) => sum + line.totalMinor, 0);
    const discountMinor = validateResult?.appliedBy
      ? toMinor(validateResult.discountTotal)
      : 0;
    const cartId = `${orderId}-cart`;
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO cart (id, "customerId", currency, "updatedAt") VALUES ($1, $2, 'EUR', now())`,
        [cartId, customerId],
      );
      await client.query(
        `INSERT INTO shop_order (id, "cartId", "customerId", currency, "itemsSubtotalMinor", "shippingMinor",
           "discountTotalMinor", "taxTotalMinor", "grandTotalMinor", "shippingMethodId", "updatedAt")
         VALUES ($1, $2, $3, 'EUR', $4, 0, $5, 0, $6, 'ship-story', now())`,
        [
          orderId,
          cartId,
          customerId,
          subtotal,
          discountMinor,
          subtotal - discountMinor,
        ],
      );
      for (const line of priced) {
        await client.query(
          `INSERT INTO order_line (id, "orderId", "offerItemId", "productName", "variantLabel", "categorySlug",
             "sellerDisplayName", quantity, "unitPriceMinor", "taxRateBasisPoints", "taxMinor", "totalMinor")
           VALUES ($1, $2, $3, $4, 'Default', 'story-fixtures', 'Story seller', $5, $6, 0, 0, $7)`,
          [
            line.lineId,
            orderId,
            `oi-${line.product}`,
            PRODUCTS[line.product].name,
            line.quantity,
            PRODUCTS[line.product].priceMinor,
            line.totalMinor,
          ],
        );
      }
      if (validateResult?.appliedBy === "promotion") {
        const discountId = `${orderId}-discount`;
        await client.query(
          `INSERT INTO order_discount (id, "orderId", "promotionId", label, "appliedMinor")
           VALUES ($1, $2, $3, 'Promotion', $4)`,
          [discountId, orderId, validateResult.promotionId, discountMinor],
        );
        for (const [index, item] of validateResult.items.entries()) {
          const amount = toMinor(item.discount);
          if (amount === 0) continue;
          await client.query(
            `INSERT INTO order_discount_allocation ("discountId", "orderId", "orderLineId", "amountMinor")
             VALUES ($1, $2, $3, $4)`,
            [discountId, orderId, priced[index].lineId, amount],
          );
        }
      }
      await client.query("COMMIT");
      orders.push({ orderId, cartId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  async function removeOrders() {
    for (const { orderId, cartId } of orders) {
      await client.query(
        `DELETE FROM order_discount_allocation WHERE "orderId" = $1`,
        [orderId],
      );
      await client.query(`DELETE FROM order_discount WHERE "orderId" = $1`, [
        orderId,
      ]);
      await client.query(`DELETE FROM order_line WHERE "orderId" = $1`, [
        orderId,
      ]);
      await client.query(`DELETE FROM shop_order WHERE id = $1`, [orderId]);
      await client.query(`DELETE FROM cart WHERE id = $1`, [cartId]);
    }
    orders.length = 0;
  }

  return { catalog, placeOrder, removeOrders, close: () => client.end(), run };
}
