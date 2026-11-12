import { defineConfig, devices } from "@playwright/test";

const chromiumPath = process.env.TRIVALLEY_CHROMIUM_PATH;

export default defineConfig({
  testMatch: "site.spec.mjs",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "https://www.trivalley.fit",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 14"], browserName: "webkit" },
    },
  ],
});
