import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("관리자 화면 렌더 + 품목 설정 승인 요청", async ({ page }) => {
  await login(page, "admin@scm.test");
  await page.goto("/admin/settings"); await expect(page.getByTestId("setting-flex_ranges")).toContainText("1번째 달 ±20%"); await expect(page.getByText("ol_lead_months")).toHaveCount(0);
  await page.goto("/admin/suppliers"); await expect(page.getByText("SUP-VN")).toBeVisible();
  await page.goto("/admin/holidays?year=2026"); await expect(page.getByText("개천절")).toBeVisible();
  await page.goto("/admin/eol"); await expect(page.getByText("MDL156")).toBeVisible();
  await page.goto("/admin/item-settings?item=556K59129");
  await expect(page.getByRole("heading", { name: "품목 설정" })).toBeVisible();
  await page.screenshot({ path: "test-results/item-settings.png", fullPage: true });
});
