import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test.describe.configure({ mode: "serial" });
test("추가수요 등록(수주확정·Bulkdeal) → 계획 생성 → 오버라이드 → 확정 → 승인 → 제출 OL → 보고", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "manager@scm.test");
  // 추가 수요
  await page.goto("/extra-demand");
  await page.selectOption("select[name=kind]", "confirmed_order");
  await page.fill("input[name=item_code]", "556K59129"); await page.fill("input[name=need_ym]", "2026-10"); await page.fill("input[name=qty]", "40"); await page.fill("input[name=order_no]", "SO-E2E-001");
  await page.getByRole("button", { name: "등록" }).click(); await expect(page.getByText("등록됨")).toBeVisible();
  await page.selectOption("select[name=kind]", "bulkdeal");
  await page.fill("input[name=item_code]", "556K59129"); await page.fill("input[name=need_ym]", "2026-10"); await page.fill("input[name=qty]", "500");
  await page.fill("input[name=customer]", "E2E고객"); await page.fill("input[name=model]", "MDL213"); await page.fill("input[name=reason]", "E2E 대량 거래");
  await page.getByRole("button", { name: "등록" }).click(); await expect(page.getByText("팀장 승인 요청됨")).toBeVisible();
  // 계획 생성
  await page.goto("/orders");
  await page.fill("input[name=plan_ym]", "2026-09");
  await page.getByRole("button", { name: /계획 생성/ }).click();
  await page.waitForURL("**/orders/*", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "발주 계획 2026-09" })).toBeVisible();
  const cards = page.locator("a[aria-label$='상세 보기']"); await expect(cards).toHaveCount(5);
  await page.screenshot({ path: "test-results/order-plan.png" });
  // 라인 검색 → 오버라이드
  await page.goto(page.url().split("?")[0] + "?q=556K59129");
  await page.locator("[data-testid=line-grid] tbody tr").filter({ hasText: "556K59129" }).first().click();
  await page.fill("input[name=override_qty]", "999"); await page.fill("textarea[name=override_reason]", "E2E 오버라이드");
  await page.getByRole("button", { name: "저장" }).click(); await expect(page.getByText("오버라이드 저장")).toBeVisible();
  await expect(page.locator("input[name=override_qty]")).toHaveCount(0);
  // 확정
  await page.getByRole("button", { name: /확정 → 팀장/ }).click();
  await expect(page.locator("textarea[name=confirm_reason]")).toBeVisible();
  await page.getByRole("button", { name: "확정", exact: true }).click();
  await expect(page.getByText("승인 요청을 보냈습니다")).toBeVisible();
  await expect(page.getByText("확정(승인 대기)").first()).toBeVisible();
  const planUrl = page.url().split("?")[0];
  // 팀장 승인 (계획 + bulkdeal)
  await page.context().clearCookies(); await login(page, "lead@scm.test");
  await page.goto("/approvals?status=pending");
  for (const text of ["발주 계획 승인", "Bulkdeal 추가 발주"]) {
    const row = page.locator("[data-testid=approval-row]").filter({ hasText: text }).first();
    await expect(row).toBeVisible(); await row.getByRole("button", { name: "승인" }).click(); await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("승인했습니다")).toBeVisible(); await page.waitForTimeout(500);
  }
  await page.goto(planUrl); await expect(page.getByText("승인", { exact: true }).first()).toBeVisible();
  await page.goto(planUrl + "/report"); await expect(page.getByText("당월 총 발주금액")).toBeVisible();
  await page.screenshot({ path: "test-results/order-report.png", fullPage: true });
});
