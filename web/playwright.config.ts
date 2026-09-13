import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",   // E2E 주문·더미 입고 픽스처 리셋 (D-036)
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  // E2E_BASE_URL 이 주어지면(이미 떠 있는 개발 서버, 예: http://localhost:3001) 서버를 새로 띄우지 않는다 — Next 16 은 같은 디렉터리에 dev 서버 2개를 허용하지 않음
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", port: 3000, reuseExistingServer: true, timeout: 120_000 },
  reporter: [["list"]],
});
