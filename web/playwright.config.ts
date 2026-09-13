import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", port: 3000, reuseExistingServer: true, timeout: 120_000 },
  reporter: [["list"]],
});
