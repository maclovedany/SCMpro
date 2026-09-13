import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("AI 제안 → 승인 요청 → 팀장 반려 (승인 경로는 sp2-verification 기록)", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/forecast/runs");
  await page.locator("tbody tr").filter({ hasText: "backtest" }).first().locator("a").click();
  const box = page.getByTestId("proposals");
  await expect(box).toContainText("진단");
  const pendingBtn = box.getByRole("button", { name: "팀장 승인 요청" }).first();
  if (!(await pendingBtn.isVisible())) { test.info().annotations.push({ type: "skip-reason", description: "대기 중 AI 제안 없음 (이미 처리됨)" }); return; }
  await box.getByPlaceholder("승인 요청 사유 (필수)").first().fill("E2E: AI 조정안 검토 완료");
  await pendingBtn.click();
  await expect(page.getByText("승인 요청 완료")).toBeVisible();
  await page.context().clearCookies();
  await login(page, "upflash@naver.com");
  await page.goto("/approvals?status=pending");
  const row = page.locator("[data-testid=approval-row]").filter({ hasText: "AI 예측 조정" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "반려" }).click();
  await page.fill("textarea[name=comment]", "E2E: 검토 후 반려");
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("반려했습니다")).toBeVisible();
  await page.goto("/approvals?status=rejected");
  await expect(page.locator("[data-testid=approval-row]").filter({ hasText: "AI 예측 조정" }).first()).toBeVisible();
});
