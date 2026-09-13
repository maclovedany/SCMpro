import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("일정 캘린더 · 수요자료 제출 · tick · 출항 규칙 편집", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");
  await page.goto("/schedule");
  await expect(page.locator("[data-testid=cal-row]").first()).toBeVisible();
  const cards = page.locator("a[aria-label$='상세 보기']"); await expect(cards).toHaveCount(4);
  const salesRow = page.locator("[data-testid=dept-row]").filter({ hasText: "영업부" });
  if (await salesRow.getByRole("button", { name: "제출" }).count()) { await salesRow.getByRole("button", { name: "제출" }).click(); await expect(page.getByText("제출 완료")).toBeVisible(); }
  await expect(page.locator("[data-testid=dept-row]").filter({ hasText: "영업부" })).toContainText("제출 ·");
  await page.getByRole("button", { name: "tick 실행" }).click(); await expect(page.getByText(/tick: 미제출 알림/)).toBeVisible();
  await page.screenshot({ path: "test-results/schedule.png", fullPage: true });
  await page.context().clearCookies(); await login(page, "insightdany@naver.com");
  await page.goto("/admin/suppliers");
  await page.getByLabel("출항 요일").first().selectOption("2");
  await page.getByRole("button", { name: "저장" }).first().click(); await expect(page.getByText("출항 규칙 저장")).toBeVisible();
});
