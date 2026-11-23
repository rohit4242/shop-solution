import { defineConfig } from "@playwright/test";

const existingBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const defaultBaseUrl = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: existingBaseUrl ?? defaultBaseUrl, headless: true },
  webServer: existingBaseUrl
    ? undefined
    : {
        command: "corepack pnpm dev --hostname 127.0.0.1",
        url: defaultBaseUrl,
        reuseExistingServer: true,
        timeout: 120000,
      },
});
