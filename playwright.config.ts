import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";
const startServer = process.env.E2E_NO_SERVER !== "1";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "line",
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: startServer
    ? {
        command: "npm run dev -- --port 3000",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "public-desktop",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "public-mobile",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "desktop",
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: "e2e/.auth/user.json",
      },
    },
    {
      name: "mobile",
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        storageState: "e2e/.auth/user.json",
      },
    },
  ],
});
