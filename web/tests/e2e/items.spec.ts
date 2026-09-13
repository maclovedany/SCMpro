import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("품목 목록 필터·상세", async ({ page }) => {
  await login(page, "manager@scm.test");
  await page.goto("/items?category=PART");
  await expect(page.getByText(/개 · 부품은 HOC/)).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.goto("/items/556K59129");
  await expect(page.getByRole("heading", { name: "556K59129" })).toBeVisible();
  await expect(page.getByText("XCN 연계 코드")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/item-detail.png", fullPage: true });
  await page.goto("/items?target_dos=missing");
  await expect(page.getByText("목표 DoS 미설정 ✕")).toBeVisible();
});
