import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("AI 제안 → 승인 요청 → 팀장 승인 → params 반영", async ({ page }) => {
  await login(page, "manager@scm.test");
  await page.goto("/forecast/runs");
  await page.locator("tbody tr").filter({ hasText: "backtest" }).first().locator("a").click();
  const box = page.getByTestId("proposals");
  await expect(box).toContainText("진단");
  const pendingBtn = box.getByRole("button", { name: "팀장 승인 요청" }).first();
  if (await pendingBtn.isVisible()) {
    await box.getByPlaceholder("승인 요청 사유 (필수)").first().fill("E2E: AI 조정안 검토 완료");
    await pendingBtn.click();
    await expect(page.getByText("승인 요청 완료")).toBeVisible();
  }
  await page.context().clearCookies();
  await login(page, "lead@scm.test");
  await page.goto("/approvals?status=pending");
  const row = page.locator("[data-testid=approval-row]").filter({ hasText: "AI 예측 조정" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "승인" }).click();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("승인했습니다")).toBeVisible();
});
