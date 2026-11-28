// Stand-in for the catalog, which is not in shop-solution yet, written straight into the shared shop tables
// of a DISPOSABLE local database (prisma/schema.prisma). Used only by the Marketing system test.
//
//   catalog()  products M1 (EUR 59.90) and M2 (EUR 20.00), each with a default variant and one seller offer.
//              Idempotent.
//
// Never point DATABASE_URL at a shared environment.
import pg from "pg";

const PRODUCTS = {
  M1: { name: "M1", priceMinor: 5990 },
  M2: { name: "M2", priceMinor: 2000 },
};

export async function createFixtures(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  async function catalog() {
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
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  return { catalog, close: () => client.end() };
}
