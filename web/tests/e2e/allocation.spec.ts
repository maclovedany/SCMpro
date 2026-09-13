import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test.describe.configure({ mode: "serial" });
const ITEM = "556K59129";
test("영업 주문 → 임시배정 → 부족 시 부분/대기 → 입고 자동배정 → 수동 우선배정 승인 → 확정 → 해제 → tick", async ({ page }) => {
  test.setTimeout(240_000);
  // 영업: 가용 조회 + 주문 1 (가용 내)
  await login(page, "sales@scm.test");
  await page.goto(`/sales-orders?item=${ITEM}`);
  const availText = await page.getByTestId("avail").innerText();
  const avail = Number(availText.match(/가용 ([\d,]+)/)![1].replace(/,/g, ""));
  expect(avail).toBeGreaterThan(0);
  await page.fill("input[name=qty]", String(Math.max(1, Math.floor(avail / 2)))); await page.fill("input[name=customer]", "E2E-A");
  await page.getByRole("button", { name: "검토 요청 등록" }).click();
  await expect(page.getByText(/등록: 검토 요청/)).toBeVisible();
  // 주문 2: 가용 초과 → 부분 임시배정
  await page.goto(`/sales-orders?item=${ITEM}`);
  await page.fill("input[name=qty]", String(avail * 2)); await page.fill("input[name=customer]", "E2E-B"); await page.selectOption("select[name=alloc_mode]", "partial");
  await page.getByRole("button", { name: "검토 요청 등록" }).click();
  await expect(page.getByText(/등록: 부분 임시배정/)).toBeVisible();
  // 주문 3: 전체 대기
  await page.goto(`/sales-orders?item=${ITEM}`);
  await page.fill("input[name=qty]", "10"); await page.fill("input[name=customer]", "E2E-C"); await page.selectOption("select[name=alloc_mode]", "wait");
  await page.getByRole("button", { name: "검토 요청 등록" }).click();
  await expect(page.getByText(/등록: 배정 대기/)).toBeVisible();
  await page.goto(`/sales-orders?item=${ITEM}`);
  await expect(page.getByTestId("avail")).toContainText("가용 0");
  // 주문 1 수주 확정 → 확정배정
  const rowA = page.locator("[data-testid=so-row]").filter({ hasText: "E2E-A" }).first();
  await rowA.getByRole("button", { name: "수주 확정" }).click(); await expect(page.getByText("수주 확정 → 확정배정")).toBeVisible();
  // SCM: 큐에서 순번 2(E2E-C) 우선배정 → 승인 필요. 먼저 입고 처리로 가용 확보
  await page.context().clearCookies(); await login(page, "manager@scm.test");
  await page.goto("/allocation");
  await expect(page.locator("[data-testid=queue-row]").filter({ hasText: ITEM }).first()).toBeVisible();
  const inb = page.locator("[data-testid=inbound-row]").filter({ hasText: "PO-E2E-ALLOC" }).first();
  if (await inb.count()) { await inb.getByRole("button", { name: "입고 완료" }).click(); await expect(page.getByText(/입고 완료 ·/)).toBeVisible(); await page.reload(); await expect(page.locator("[data-testid=queue-row]").first()).toBeVisible(); }
  await page.screenshot({ path: "test-results/allocation.png", fullPage: true });
  // 우선 배정(승인) 버튼이 있는 행 (순번 ≠ 1, 가용 > 0) 이 있으면 승인 흐름
  const prioBtn = page.getByRole("button", { name: "우선 배정(승인)" }).first();
  if (await prioBtn.isVisible()) {
    await prioBtn.click(); await page.fill("input[name=alloc_qty]", "1"); await page.fill("textarea[name=alloc_reason]", "E2E 긴급 고객");
    await page.getByRole("button", { name: "배정", exact: true }).click(); await expect(page.getByText(/팀장 승인 요청/)).toBeVisible();
    await page.getByRole("button", { name: /tick/ }).click(); await expect(page.getByText(/승인 반복 알림/)).toBeVisible();
    await page.context().clearCookies(); await login(page, "lead@scm.test");
    await page.goto("/approvals?status=pending");
    const row = page.locator("[data-testid=approval-row]").filter({ hasText: "우선 배정" }).first();
    await expect(row).toBeVisible(); await row.getByRole("button", { name: "승인" }).click(); await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("승인했습니다")).toBeVisible();
  }
  // 사업강화부 우선순위
  await page.context().clearCookies(); await login(page, "biz@scm.test");
  await page.goto("/allocation/priority");
  const prow = page.locator("[data-testid=prio-row]").first();
  if (await prow.count()) { const no = (await prow.locator("td").nth(1).innerText()).trim(); await page.getByLabel(`${no} 우선순위`).fill("1"); await page.getByLabel(`${no} 사유`).fill("E2E 전략 고객"); await prow.getByRole("button", { name: "저장" }).click(); await expect(page.getByText("우선순위 변경")).toBeVisible(); }
  // SCM: 확정배정 해제 → 주문 취소
  await page.context().clearCookies(); await login(page, "manager@scm.test");
  await page.goto("/sales-orders?all=1");
  const confirmed = page.locator("[data-testid=so-row]").filter({ hasText: "E2E-A" }).first();
  await confirmed.getByRole("button", { name: "확정배정 해제" }).click(); await page.fill("textarea[name=cancel_reason]", "E2E 해제"); await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("취소 · 배정 해제")).toBeVisible();
});
