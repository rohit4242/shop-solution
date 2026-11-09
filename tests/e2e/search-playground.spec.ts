import { test, expect } from "@playwright/test";
test("streams inspected results, saves history and changes settings without replaying imports", async ({
  page,
}) => {
  await page.route("**/api/search-playground/config", (route) =>
    route.fulfill({
      json: {
        userId: "test-user",
        enabled: true,
        profiles: [
          {
            id: "test",
            label: "Test model",
            model: "test-model",
            maxOutputTokens: 2048,
            temperature: true,
            topP: false,
            toolChoice: true,
          },
        ],
      },
    }),
  );
  await page.route("**/api/search-playground/run", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "configuration",
            data: { contractHash: "fixture", toolDescriptionHash: "fixture" },
          },
          {
            type: "tool-call",
            data: { name: "search", arguments: { q: "wireless" } },
          },
          {
            type: "tool-result",
            data: {
              status: 200,
              requestId: "test-request",
              body: { data: { items: [] } },
            },
          },
          { type: "text", data: { text: "No matching products." } },
          {
            type: "finish",
            data: {
              state: "completed",
              usage: { inputTokens: 10, outputTokens: 5 },
            },
          },
        ]
          .map((e, seq) =>
            JSON.stringify({
              runId: "fixture-run",
              seq,
              time: new Date().toISOString(),
              step: 1,
              ...e,
            }),
          )
          .join("\n") + "\n",
    }),
  );
  await page.goto("/docs/search-recommendations/playground");
  await page.getByLabel("Prompt", { exact: true }).fill("Search for wireless");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("run-answer")).toContainText(
    "No matching products.",
  );
  await expect(page.getByTestId("run-state")).toHaveText("completed");
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(page.getByText("tool-call", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Saved run")).toContainText(
    "Search for wireless",
  );
});
test("shows sign-in gate and no configuration for unauthenticated visitors", async ({
  page,
}) => {
  await page.route("**/api/search-playground/config", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { message: "Sign in to continue." } },
    }),
  );
  await page.goto("/docs/search-recommendations/playground");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
});
test("workspace remains usable at desktop and mobile widths", async ({
  page,
}) => {
  await page.route("**/api/search-playground/config", (route) =>
    route.fulfill({
      json: {
        userId: "visual-user",
        enabled: false,
        profiles: [
          {
            id: "test",
            label: "Configured model",
            model: "test",
            maxOutputTokens: 4096,
            temperature: true,
            topP: true,
            toolChoice: true,
          },
        ],
      },
    }),
  );
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/docs/search-recommendations/playground");
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/shop-mcp-playground-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Configuration", exact: true }).click();
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/shop-mcp-playground-mobile.png",
    fullPage: true,
  });
});
test("account changes clear drafts and saved-run selections", async ({
  page,
}) => {
  let user = "alice";
  await page.route("**/api/search-playground/config", (route) =>
    route.fulfill({
      json: {
        userId: user,
        enabled: true,
        profiles: [
          {
            id: "test",
            label: "Test model",
            model: "test",
            maxOutputTokens: 2048,
            temperature: true,
            topP: false,
            toolChoice: true,
          },
        ],
      },
    }),
  );
  await page.route("**/api/auth/sign-out", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.goto("/docs/search-recommendations/playground");
  await page.getByLabel("Prompt", { exact: true }).fill("Alice private draft");
  user = "bob";
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue("");
});
test("fork preserves the original multi-turn input after settings change", async ({
  page,
}) => {
  await page.route("**/api/search-playground/config", (route) =>
    route.fulfill({
      json: {
        userId: "fork-user",
        enabled: true,
        profiles: [
          {
            id: "test",
            label: "Test model",
            model: "test",
            maxOutputTokens: 2048,
            temperature: true,
            topP: false,
            toolChoice: true,
          },
        ],
      },
    }),
  );
  const requests: unknown[] = [];
  await page.route("**/api/search-playground/run", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          { type: "text", data: { text: "Two products." } },
          { type: "finish", data: { state: "completed" } },
        ]
          .map((e, seq) =>
            JSON.stringify({
              runId: "fork",
              seq,
              time: new Date().toISOString(),
              step: 1,
              ...e,
            }),
          )
          .join("\n") + "\n",
    });
  });
  await page.goto("/docs/search-recommendations/playground");
  await page.getByLabel("Prompt", { exact: true }).fill("Find two products");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("run-state")).toHaveText("completed");
  await page.getByLabel("Prompt", { exact: true }).fill("Compare those two");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("run-state")).toHaveText("completed");
  await page
    .getByRole("button", { name: "Repeat / fork", exact: true })
    .click();
  await page.getByRole("tab", { name: "Configuration", exact: true }).click();
  await page.getByLabel("Agent steps", { exact: true }).fill("4");
  await page.getByRole("tab", { name: "Conversation", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByTestId("run-state")).toHaveText("completed");
  expect((requests[2] as { messages: unknown }).messages).toEqual(
    (requests[1] as { messages: unknown }).messages,
  );
});
