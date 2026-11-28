import { expect, test } from "@playwright/test";

// Marketing, story step j in the UI. Needs a database and a local login, so it runs only with
// MARKETING_E2E=1 against an app started with MARKETING_AUTH_MODE=local,
// MARKETING_MANAGER_EMAILS=manager@shop.test and MARKETING_RESET_ENABLED=true.
// See src/features/marketing/README.md ("Verification"). The tests do not reset (they may run in parallel);
// each one uses its own promotion name and checks only that promotion.

const enabled = process.env.MARKETING_E2E === "1";
const email = process.env.MANAGER_EMAIL ?? "manager@shop.test";
const password = process.env.TEST_PASSWORD ?? "story-test-password-1";

test.describe("marketing promotions screen", () => {
  test.skip(
    !enabled,
    "Set MARKETING_E2E=1 with a database and local Marketing auth.",
  );

  test.beforeEach(async ({ page, baseURL }) => {
    const headers = {
      origin: baseURL ?? "",
      "content-type": "application/json",
    };
    const signIn = await page.request.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password },
    });
    if (!signIn.ok()) {
      await page.request.post("/api/auth/sign-up/email", {
        headers,
        data: { email, password, name: "Manager" },
      });
    }
  });

  test("shows field errors and keeps the input when the form is incomplete", async ({
    page,
  }) => {
    await page.goto("/marketing/promotions");
    await page.getByLabel("Description").fill("10 % off M1");
    await page.getByRole("button", { name: "Create promotion" }).click();
    await expect(
      page.getByRole("form", { name: "New promotion" }).getByRole("alert"),
    ).toHaveText("The request is not valid.");
    await expect(page.locator("#name-error")).toBeVisible();
    await expect(page.getByLabel("Description")).toHaveValue("10 % off M1");
  });

  test("creates the 10 % promotion for M1 and can deactivate it", async ({
    page,
  }, testInfo) => {
    const name = `M1 10 % e2e-${testInfo.repeatEachIndex}-${Date.now()}`;
    await page.goto("/marketing/promotions");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description").fill("10 % off M1");
    await page.getByLabel("Value").fill("10");
    await page.getByLabel("Product IDs (comma-separated)").fill("M1");
    await page.getByLabel("Valid to (optional)").fill("2030-12-31T23:59");
    await page.getByRole("button", { name: "Create promotion" }).click();
    await expect(
      page.getByRole("form", { name: "New promotion" }).getByRole("status"),
    ).toHaveText(`Promotion "${name}" created.`);

    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("10 %");
    await expect(row).toContainText("Products: M1");
    await expect(row).toContainText("Active");

    const active = await page.request.get(
      "/api/v1/marketing/promotions/active",
    );
    const mine = (await active.json()).data.filter(
      (promotion: { name: string }) => promotion.name === name,
    );
    expect(mine).toMatchObject([{ value: 10, productIds: ["M1"] }]);

    await row.getByRole("button", { name: `Deactivate ${name}` }).click();
    await expect(row).toContainText("Inactive");
  });
});
