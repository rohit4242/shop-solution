import { test, expect } from "@playwright/test";

const workbench = "/docs/search-recommendations/discover";

const product = {
  offerId: "off_1",
  productId: "prd_1",
  sellerId: "sel_2",
  name: "Wireless Mouse",
  category: "Electronics",
  imageUrls: [],
  priceMinor: 1999,
  currency: "EUR",
  availability: "in_stock",
};

const searchResponse = (items = [product], page = 1) => ({
  data: {
    items,
    total: items.length,
    page,
    pageSize: 20,
  },
});

const recommendationResponse = (item: typeof product) => ({
  data: { items: [item] },
});

test("starts in the empty state without calling the API", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) apiRequests.push(request.url());
  });

  await page.goto(workbench);

  await expect(
    page.getByText("Enter a phrase to search the mock catalog."),
  ).toBeVisible();
  await expect(
    page.getByText("Enter a product ID to inspect recommendations."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Similar" })).toBeDisabled();
  expect(apiRequests).toEqual([]);
});

test("shows the shared Identity session without gating public discovery", async ({
  page,
}) => {
  await page.route("**/api/integrations/admin-identity/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        email: "admin@example.com",
        displayName: "Admin",
      },
    }),
  );

  await page.goto(workbench);

  await expect(
    page.getByText(
      "Signed in as Admin (admin@example.com). Search uses the same shared session.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Similar" })).toBeDisabled();
});

test("shows signed-out status while keeping search available", async ({
  page,
}) => {
  await page.route("**/api/integrations/admin-identity/session", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );

  await page.goto(workbench);

  await expect(
    page.getByText(
      "Not signed in. Search remains public; no separate login is needed.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
});

test("searches the catalog and shows contract fields", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/v1/search**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ json: searchResponse() });
  });

  await page.goto(workbench);
  const searchField = page.getByRole("textbox", { name: "Search phrase" });
  await searchField.fill("wireless");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();
  await expect(page.getByText("Showing 1–1 of 1 products")).toBeVisible();
  await expect(page.getByText("prd_1", { exact: true })).toBeVisible();
  await expect(page.getByText("€19.99", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  const requestUrl = new URL(requests[0]);
  expect(requestUrl.pathname).toBe("/api/v1/search");
  expect(requestUrl.searchParams.get("q")).toBe("wireless");
  expect(requestUrl.searchParams.get("page")).toBe("1");
});

test("shows an empty result without clearing the search phrase", async ({
  page,
}) => {
  await page.route("**/api/v1/search**", (route) =>
    route.fulfill({ json: searchResponse([], 1) }),
  );

  await page.goto(workbench);
  const searchField = page.getByRole("textbox", { name: "Search phrase" });
  await searchField.fill("unknown");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(
    page.getByText("No products matched your search. Try another phrase."),
  ).toBeVisible();
  await expect(searchField).toHaveValue("unknown");
});

test("moves between search result pages using the API pagination fields", async ({
  page,
}) => {
  const requestedPages: string[] = [];
  await page.route("**/api/v1/search**", async (route) => {
    const url = new URL(route.request().url());
    const currentPage = url.searchParams.get("page") ?? "1";
    requestedPages.push(currentPage);
    const item =
      currentPage === "1"
        ? product
        : { ...product, productId: "prd_2", name: "Quiet Mouse" };
    await route.fulfill({
      json: {
        data: {
          items: [item],
          total: 21,
          page: Number(currentPage),
          pageSize: 20,
        },
      },
    });
  });

  await page.goto(workbench);
  await page.getByRole("textbox", { name: "Search phrase" }).fill("mouse");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Quiet Mouse", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();
  expect(requestedPages).toEqual(["1", "2", "1"]);
});

test("uses both recommendation operations and preserves the product ID on 404", async ({
  page,
}) => {
  const operations: string[] = [];
  await page.route("**/api/v1/recommendations/**", async (route) => {
    const url = new URL(route.request().url());
    operations.push(`${url.pathname}?${url.searchParams}`);
    const recommendation = url.pathname.endsWith("/similar")
      ? { ...product, productId: "prd_5", name: "Desk Speaker" }
      : { ...product, productId: "prd_2", name: "Quiet Mouse" };
    await route.fulfill({ json: recommendationResponse(recommendation) });
  });

  await page.goto(workbench);
  const productField = page.getByRole("textbox", { name: "Product ID" });
  await productField.fill("prd_1");
  await page.getByRole("button", { name: "Similar" }).click();
  await expect(page.getByText("Desk Speaker", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Also bought" }).click();
  await expect(page.getByText("Quiet Mouse", { exact: true })).toBeVisible();
  expect(operations).toEqual([
    "/api/v1/recommendations/similar?productId=prd_1",
    "/api/v1/recommendations/also-bought?productId=prd_1",
  ]);

  await page.unroute("**/api/v1/recommendations/**");
  await page.route("**/api/v1/recommendations/similar**", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
      },
    }),
  );
  await productField.fill("missing");
  await page.getByRole("button", { name: "Similar" }).click();
  await expect(
    page.getByText("Product not found.", { exact: true }),
  ).toBeVisible();
  await expect(productField).toHaveValue("missing");
});

test("announces loading and disables the search action until completion", async ({
  page,
}) => {
  let releaseRequest: (() => void) | undefined;
  const pendingRequest = new Promise<void>((resolveRequest) => {
    releaseRequest = resolveRequest;
  });
  await page.route("**/api/v1/search**", async (route) => {
    await pendingRequest;
    await route.fulfill({ json: searchResponse() });
  });

  await page.goto(workbench);
  await page.getByRole("textbox", { name: "Search phrase" }).fill("wireless");
  const searchButton = page.getByRole("button", {
    name: "Searching…",
    exact: true,
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Searching catalog…", { exact: true }),
  ).toBeVisible();
  await expect(searchButton).toBeDisabled();
  releaseRequest?.();
  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();
});

test("shows the API error message and retains the search phrase", async ({
  page,
}) => {
  await page.route("**/api/v1/search**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "Catalog data is temporarily unavailable.",
        },
      },
    }),
  );

  await page.goto(workbench);
  const searchField = page.getByRole("textbox", { name: "Search phrase" });
  await searchField.fill("wireless");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(
    page.getByText("Catalog data is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(searchField).toHaveValue("wireless");
});

test("the Admin & Identity handoff links to its UI and API docs", async ({
  page,
}) => {
  await page.goto(workbench);
  await expect(
    page.getByRole("link", { name: "Admin & Identity (Back Office)" }),
  ).toHaveAttribute("href", "http://localhost:5500/");
  await expect(
    page.getByRole("link", { name: "Admin & Identity (Back Office)" }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: "Identity API docs" }),
  ).toHaveAttribute("href", "http://localhost:8000/docs");
  await expect(
    page.getByRole("link", { name: "Marketing (Campaigns & Codes)" }),
  ).toHaveAttribute("href", "http://localhost:3000/admin/codes");
});

test("the project docs navigation exposes Discovery and Admin & Identity", async ({
  page,
}) => {
  await page.goto("/docs");

  await expect(
    page.getByRole("link", { name: "Discovery workbench" }),
  ).toHaveAttribute("href", "/docs/search-recommendations/discover");
  await expect(
    page.getByRole("link", { name: "Admin & Identity UI" }),
  ).toHaveAttribute("href", "http://localhost:5500/");
});

test("completes search and recommendations using the keyboard only", async ({
  page,
}) => {
  await page.route("**/api/v1/search**", (route) =>
    route.fulfill({ json: searchResponse() }),
  );
  await page.route("**/api/v1/recommendations/similar**", (route) =>
    route.fulfill({
      json: recommendationResponse({
        ...product,
        productId: "prd_5",
        name: "Desk Speaker",
      }),
    }),
  );
  await page.route("**/api/v1/recommendations/also-bought**", (route) =>
    route.fulfill({
      json: recommendationResponse({
        ...product,
        productId: "prd_2",
        name: "Quiet Mouse",
      }),
    }),
  );

  await page.goto(workbench);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const searchField = page.getByRole("textbox", { name: "Search phrase" });
  for (let index = 0; index < 40; index += 1) {
    if (
      await searchField.evaluate(
        (element) => element === element.ownerDocument.activeElement,
      )
    ) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(searchField).toBeFocused();
  await page.keyboard.type("wireless");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();

  await page.keyboard.press("Tab");
  const useProductButton = page.getByRole("button", {
    name: "Use product ID",
  });
  await expect(useProductButton).toBeFocused();
  await page.keyboard.press("Enter");
  const productField = page.getByRole("textbox", { name: "Product ID" });
  await expect(productField).toHaveValue("prd_1");
  await page.keyboard.press("Tab");
  await expect(productField).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Similar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Desk Speaker", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Also bought" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Quiet Mouse", { exact: true })).toBeVisible();
});

test("captures the empty, loading, error and success states", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(workbench);
  const searchField = page.getByRole("textbox", { name: "Search phrase" });
  await searchField.fill("wireless");
  await searchField.fill("");
  await page.screenshot({
    path: testInfo.outputPath("empty.png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });

  let releaseRequest: (() => void) | undefined;
  const pendingRequest = new Promise<void>((resolveRequest) => {
    releaseRequest = resolveRequest;
  });
  await page.route("**/api/v1/search**", async (route) => {
    await pendingRequest;
    await route.fulfill({ json: searchResponse() });
  });
  await searchField.fill("wireless");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Searching catalog…", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("loading.png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
  releaseRequest?.();
  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();

  await page.unroute("**/api/v1/search**");
  await page.route("**/api/v1/search**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "Catalog data is temporarily unavailable.",
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Catalog data is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("error.png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });

  await page.unroute("**/api/v1/search**");
  await page.route("**/api/v1/search**", (route) =>
    route.fulfill({ json: searchResponse() }),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Wireless Mouse", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("success.png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });
});
