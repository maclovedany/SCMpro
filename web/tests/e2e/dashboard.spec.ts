import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("대시보드 카드 6개 전부 드릴다운 링크", async ({ page }) => {
  await login(page, "admin@scm.test");
  const cards = page.locator("a[aria-label$='상세 보기']");
  expect(await cards.count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByText("예측 대상 품목")).toBeVisible();
  const hrefs = await cards.evaluateAll(els => els.map(e => e.getAttribute("href")));
  expect(hrefs.every(h => h && h.startsWith("/"))).toBe(true);
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
});
test("영업 역할은 메뉴 3개", async ({ page }) => {
  await login(page, "sales@scm.test");
  await expect(page.locator("nav[aria-label='주 메뉴'] a")).toHaveCount(7);
});
