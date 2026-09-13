import { test, expect } from "@playwright/test";
import { login } from "./helpers";
const CODE = "556K59129";
test("품목담당자 승인 요청 → 팀장 승인 → 반영·알림", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto(`/admin/item-settings?item=${CODE}`);
  const dos = page.locator("input[name=target_dos_days]");
  const before = await dos.inputValue();
  const next = String((Number(before) || 30) + 5);
  await dos.fill(next);
  await page.fill("textarea[name=reason]", "E2E 테스트: 목표 DoS 조정");
  await page.click("text=승인 요청");
  await expect(page.getByText("승인 대기 중")).toBeVisible();
  // 팀장
  await page.context().clearCookies();
  await login(page, "upflash@naver.com");
  await page.goto("/notifications");
  await expect(page.getByText("승인 요청: item_setting").first()).toBeVisible();
  await page.goto("/approvals?status=pending");
  const row = page.locator("[data-testid=approval-row]").filter({ hasText: CODE }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "승인" }).click();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("승인했습니다")).toBeVisible();
  // 팀장은 품목 상세에서 반영 확인 (품목 설정 화면은 품목담당자/관리자 전용)
  await page.goto(`/items/${CODE}`);
  await expect(page.getByText(`${next} · 1`)).toBeVisible();
  // 요청자: 설정 화면 반영 + 알림
  await page.context().clearCookies();
  await login(page, "insightdany@naver.com");
  await page.goto(`/admin/item-settings?item=${CODE}`);
  await expect(page.locator("input[name=target_dos_days]")).toHaveValue(next);
  await expect(page.getByText("승인됨")).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByText("승인됨: item_setting").first()).toBeVisible();
});
