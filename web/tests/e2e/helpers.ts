import type { Page } from "@playwright/test";
export const PW = process.env.E2E_PASSWORD ?? "Scm!2026test";
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PW);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
}
