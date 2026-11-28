// Level 2 system test for story steps j, k (and Marketing's part of o), against a running app.
// Checks the real state through the API after every action: "done" is not a test result.
//
//   BASE_URL=http://localhost:3000 DATABASE_URL=... MARKETING_RESET_TOKEN=... \
//     node src/features/marketing/tests/system/steps-j-k.mjs
//
// Needs the app with MARKETING_AUTH_MODE=local, MARKETING_RESET_ENABLED=true and
// MARKETING_MANAGER_EMAILS containing MANAGER_EMAIL (default manager@shop.test), on the same database
// as DATABASE_URL (a disposable local one).
//
// Stand-ins, because those modules are not in shop-solution yet (see ./fixtures.mjs):
//   - catalog: products M1 (EUR 59.90) and M2 (EUR 20.00) with one seller offer each;
//   - checkout: writes the order and the applied discount (shared order_discount tables) exactly as
//     validate returned it, which is what Storefront's checkout is meant to do.
// Exit code 0 = every check passed.

import { createFixtures } from "./fixtures.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/v1/marketing`;
const M1 = "M1";
const M1_PRICE = 59.9;
const MANAGER = process.env.MANAGER_EMAIL ?? "manager@shop.test";
const CUSTOMER = process.env.CUSTOMER_EMAIL ?? "customer@shop.test";
const PASSWORD = process.env.TEST_PASSWORD ?? "story-test-password-1";
const RUN = Date.now().toString(36);

let failed = 0;
function check(name, condition, detail) {
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      got: ${JSON.stringify(detail)}`}`,
  );
  if (!condition) failed += 1;
}

async function call(method, url, { body, cookie, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return {
    status: response.status,
    json,
    setCookie: response.headers.getSetCookie?.() ?? [],
  };
}

// Better Auth email/password; signs up on the first run, signs in afterwards.
async function login(email) {
  let res = await call("POST", `${BASE}/api/auth/sign-in/email`, {
    body: { email, password: PASSWORD },
  });
  if (res.status !== 200) {
    res = await call("POST", `${BASE}/api/auth/sign-up/email`, {
      body: { email, password: PASSWORD, name: email.split("@")[0] },
    });
  }
  const cookie = res.setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!cookie)
    throw new Error(
      `login failed for ${email}: HTTP ${res.status} ${JSON.stringify(res.json)}`,
    );
  return cookie;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (the app's disposable database).");
  process.exit(2);
}
const fixtures = await createFixtures(process.env.DATABASE_URL, RUN);

const resetHeaders = process.env.MARKETING_RESET_TOKEN
  ? { authorization: `Bearer ${process.env.MARKETING_RESET_TOKEN}` }
  : {};
const orderPlaced = (id, orderId, items) => ({
  specversion: "1.0",
  type: "order.placed",
  source: "/storefront",
  id,
  time: new Date().toISOString(),
  data: { orderId, customerId: "c-story", items, total: 0, currency: "EUR" },
});

// --- Setup: known state -------------------------------------------------------------------------
const reset = await call("POST", `${API}/reset`, { headers: resetHeaders });
check("reset: 200", reset.status === 200, reset);
const empty = await call("GET", `${API}/promotions/active`);
check(
  "reset: no active promotions",
  empty.status === 200 && empty.json?.data?.length === 0,
  empty.json,
);

const manager = await login(MANAGER);
const customer = await login(CUSTOMER);
await fixtures.catalog(CUSTOMER);
check("setup: catalog stand-in has M1 at 59.90 and M2 at 20.00", true);

// --- Step j: create the 10 % promotion for M1 ----------------------------------------------------
const promotion = {
  name: `M1 10 % ${RUN}`,
  description: "10 % off M1 (story step j)",
  type: "percent",
  value: 10,
  productIds: [M1],
  validFrom: new Date(Date.now() - 60_000).toISOString(),
  validTo: new Date(Date.now() + 30 * 86_400_000).toISOString(),
};
const anonymous = await call("POST", `${API}/promotions`, { body: promotion });
check("j: without login → 401", anonymous.status === 401, anonymous);
const notManager = await call("POST", `${API}/promotions`, {
  body: promotion,
  cookie: customer,
});
check("j: customer account → 403", notManager.status === 403, notManager);
const missing = await call("POST", `${API}/promotions`, {
  body: { ...promotion, name: undefined },
  cookie: manager,
});
check(
  "j: missing name → 400 with fieldErrors.name",
  missing.status === 400 && !!missing.json?.error?.fieldErrors?.name,
  missing.json,
);

const unknown = await call("POST", `${API}/promotions`, {
  body: { ...promotion, productIds: ["NOT-IN-CATALOG"] },
  cookie: manager,
});
check(
  "j: unknown product id → 400 with fieldErrors.productIds",
  unknown.status === 400 && !!unknown.json?.error?.fieldErrors?.productIds,
  unknown.json,
);

const created = await call("POST", `${API}/promotions`, {
  body: promotion,
  cookie: manager,
});
check(
  "j: manager creates the promotion → 201",
  created.status === 201,
  created,
);
const promotionId = created.json?.data?.promotionId;

const active = await call("GET", `${API}/promotions/active`);
const live = active.json?.data ?? [];
check(
  "j: API shows exactly one active promotion, 10 %, for M1, with a period",
  live.length === 1 &&
    live[0].promotionId === promotionId &&
    live[0].value === 10 &&
    JSON.stringify(live[0].productIds) === JSON.stringify([M1]) &&
    !!live[0].validFrom &&
    !!live[0].validTo,
  live,
);

// --- Step k: buy M1 with the promotion ------------------------------------------------------------
const expected = Math.round(M1_PRICE * 10) / 100; // 10 %, 2 places; equals half-up for 2-decimal prices
const validate = await call("POST", `${API}/discounts/validate`, {
  body: {
    currency: "EUR",
    items: [{ productId: M1, unitPrice: M1_PRICE, quantity: 1 }],
  },
});
check(
  `k: checkout validate → appliedBy promotion, discount ${expected.toFixed(2)}`,
  validate.json?.data?.appliedBy === "promotion" &&
    validate.json?.data?.promotionId === promotionId &&
    validate.json?.data?.discountTotal === expected,
  validate.json,
);

const orderK = `o-k-${RUN}`;
const eventK = orderPlaced(`evt-k-${RUN}`, orderK, [
  { productId: M1, unitPrice: M1_PRICE, quantity: 1 },
]);
// Checkout stand-in: the order and the discount validate returned, stored with the order.
await fixtures.placeOrder(
  orderK,
  [{ product: M1, quantity: 1 }],
  validate.json?.data,
);
const placed = await call("POST", `${API}/events`, { body: eventK });
check("k: order.placed accepted → 202", placed.status === 202, placed);
const resent = await call("POST", `${API}/events`, { body: eventK });
check("k: resent event accepted again → 202", resent.status === 202, resent);

const invoiceK = await call("GET", `${API}/orders/${orderK}/discounts`);
check(
  `k/o: invoice data for the M1 order shows the promotion discount ${expected.toFixed(2)}`,
  invoiceK.status === 200 &&
    invoiceK.json?.data?.appliedBy === "promotion" &&
    invoiceK.json?.data?.promotionId === promotionId &&
    invoiceK.json?.data?.discountTotal === expected &&
    invoiceK.json?.data?.items?.[0]?.productId === M1 &&
    invoiceK.json?.data?.items?.[0]?.discount === expected,
  invoiceK.json,
);

// --- Step o (Marketing's part): the order from step f has no discount ----------------------------
const orderF = `o-f-${RUN}`;
const validateF = await call("POST", `${API}/discounts/validate`, {
  body: {
    currency: "EUR",
    items: [{ productId: "M2", unitPrice: 20, quantity: 1 }],
  },
});
await fixtures.placeOrder(
  orderF,
  [{ product: "M2", quantity: 1 }],
  validateF.json?.data,
);
const invoiceF = await call("GET", `${API}/orders/${orderF}/discounts`);
check(
  "o: order without M1 has no discount → 404 order_discount_not_found",
  invoiceF.status === 404 &&
    invoiceF.json?.error?.code === "order_discount_not_found",
  invoiceF.json,
);

// --- Promotion ends: no discount any more ---------------------------------------------------------
const off = await call("POST", `${API}/promotions/${promotionId}/deactivate`, {
  cookie: manager,
});
check(
  "deactivate → 200, active false",
  off.status === 200 && off.json?.data?.active === false,
  off.json,
);
const after = await call("POST", `${API}/discounts/validate`, {
  body: {
    currency: "EUR",
    items: [{ productId: M1, unitPrice: M1_PRICE, quantity: 1 }],
  },
});
check(
  "after deactivation: no discount",
  after.json?.data?.appliedBy === null && after.json?.data?.discountTotal === 0,
  after.json,
);

await fixtures.removeOrders();
await fixtures.close();
const finalReset = await call("POST", `${API}/reset`, {
  headers: resetHeaders,
});
check(
  "final reset: 200, the story promotion is gone",
  finalReset.status === 200 && finalReset.json?.data?.deleted?.promotions >= 1,
  finalReset.json,
);

console.log(
  failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
