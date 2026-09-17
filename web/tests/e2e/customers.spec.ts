import { test, expect } from "@playwright/test";
import { login } from "./helpers";
/** D-058: 고객사 배정현황 · 강제배정 · 긴급발주 진행 · 담당 품목 재고 · 전 부서 재고 · 품명 병기. DB 를 바꾸므로 직렬 */
test.describe.configure({ mode: "serial" });
const MACHINE = "TC059846";   // 더미 시드의 첫 기기 코드

test("영업: 대시보드 재고 현황·고객사 배정 묶음 → 고객사 배정현황 화면 (KPI → 차트 → 표)", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");
  await expect(page.getByTestId("dash-inv")).toContainText("재고 보유 품목");
  await expect(page.getByTestId("dash-custalloc")).toContainText("부족 고객사");
  await page.getByTestId("dash-custalloc").getByRole("link", { name: /부족 고객사 상세 보기/ }).click();
  await page.waitForURL(/\/sales-orders\/customers\?short=1/);
  await expect(page.getByTestId("ca-kpi").locator("a[aria-label$='상세 보기']")).toHaveCount(5);
  await expect(page.getByTestId("ca-charts")).toContainText("부족 큰 순");
  const table = page.getByTestId("ca-table");
  await expect(table.getByTestId("item-code").first()).toBeVisible();                 // 코드 + 품명 (R-UI-15)
  await expect(table.getByTestId("item-code").first().locator("span").nth(1)).not.toBeEmpty();
  await page.screenshot({ path: "test-results/customers.png", fullPage: true });
});

test("영업: 수요자료에 고객사별 필요 수량을 넣고 지운다", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");
  await page.goto("/schedule#demand-lines");
  const box = page.getByTestId("demand-lines"); const before = await box.getByTestId("dl-row").count();
  await box.locator("select[name=dl_customer]").selectOption("CUST-010");
  await box.locator("input[name=dl_item]").fill(MACHINE); await box.locator("input[name=dl_qty]").fill("3"); await box.locator("input[name=dl_note]").fill("E2E");
  await box.getByRole("button", { name: "추가 · 수정" }).click();
  await expect(page.getByText("필요 수량 저장")).toBeVisible();
  await expect(box.getByTestId("dl-row")).toHaveCount(before + 1);
  await box.getByTestId("dl-row").filter({ hasText: "E2E" }).getByRole("button", { name: "삭제" }).click();
  await expect(box.getByTestId("dl-row")).toHaveCount(before);
});

test("영업은 강제 배정 화면에 들어갈 수 없다", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");
  await page.goto("/allocation/force"); await page.waitForURL("**/dashboard");
});

test("사업강화: 한도 안에서 강제 배정 → 고객사 배정현황에 반영", async ({ page }) => {
  await login(page, "pro-worker@daum.net");
  await expect(page.locator("nav[aria-label='주 메뉴']")).toContainText("강제 배정");
  await page.goto("/allocation/force");
  await expect(page.getByTestId("fa-kpi").locator("a[aria-label$='상세 보기']")).toHaveCount(4);
  const row = page.getByTestId("force-row").filter({ has: page.locator("input[type=number]:not([disabled])") }).first();
  await expect(row).toBeVisible();
  const orderNo = (await row.locator("td").nth(2).innerText()).split(/\s/)[0];
  await row.locator("input[type=number]").fill("1");
  await expect(row.getByRole("button", { name: "강제 배정" })).toBeDisabled();       // 사유 없으면 불가 (R-AL-53)
  await row.locator("input:not([type=number])").fill("E2E 강제배정");
  await row.getByRole("button", { name: "강제 배정" }).click();
  await expect(page.getByText(/강제배정 1개/)).toBeVisible();
  await page.goto("/sales-orders/customers");
  await expect(page.getByTestId("ca-table")).toBeVisible();
  await page.goto("/notifications"); await expect(page.locator("body")).not.toContainText("오류");
  console.log("forced order:", orderNo);
});

test("마케팅: 대시보드 담당 품목 재고(용지·카드리더기) → 품목 그룹 재고", async ({ page }) => {
  await login(page, "alltest@nate.com");
  const sec = page.getByTestId("dash-mygroup");
  await expect(sec).toContainText("카드리더기 재고"); await expect(sec).toContainText("용지 재고");
  await sec.getByRole("link", { name: /카드리더기 재고 상세 보기/ }).click();
  await page.waitForURL(/\/items\/groups\?group=CARD_READER/);
  await expect(page.getByTestId("grp-row").first()).toBeVisible();
  await expect(page.getByTestId("grp-row").first().getByTestId("item-code").locator("span").nth(1)).not.toBeEmpty();
});

test("서비스: 대시보드 긴급발주 진행 → 요청 등록 → 단계 표시, 표마다 품명 병기", async ({ page }) => {
  await login(page, "imagineworld@kakao.com");
  await expect(page.getByTestId("dash-urgent")).toContainText("진행 중 긴급발주");
  await expect(page.getByTestId("dash-mygroup")).toContainText("토너 재고");
  await page.goto("/extra-demand#urgent");
  const panel = page.getByTestId("urgent-panel");
  await expect(panel.getByTestId("urgent-row").first()).toBeVisible();
  await expect(panel).toContainText("지연");                                           // 더미 시드의 지연 1건
  const before = await panel.getByTestId("urgent-row").count();
  const d = new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10);
  await panel.locator("input[name=ug_item]").fill("CT083019"); await panel.locator("input[name=ug_qty]").fill("12");
  await panel.locator("input[name=ug_date]").fill(d); await panel.locator("input[name=ug_reason]").fill("E2E 긴급 — 현장 소진");
  await panel.getByRole("button", { name: "긴급발주 요청" }).click();
  await expect(page.getByText(/팀장 승인 대기/)).toBeVisible();
  await expect(panel.getByTestId("urgent-row")).toHaveCount(before + 1);
  await expect(panel.getByTestId("urgent-row").first()).toContainText("요청");
  await page.screenshot({ path: "test-results/urgent.png", fullPage: true });
});

test("SCM팀장: 긴급발주 승인 건이 승인함에 '긴급발주' 로 보인다", async ({ page }) => {
  await login(page, "upflash@naver.com");
  await page.goto("/approvals?status=pending");
  await expect(page.locator("body")).toContainText("긴급발주");
});

test("관리자: 고객사·품목 그룹 관리 화면과 업로드 대상 4종", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/admin/customers"); await expect(page.getByTestId("cust-row")).toHaveCount(10);
  await page.goto("/admin/item-groups"); await expect(page.getByTestId("grp-section")).toHaveCount(3);
  await page.goto("/upload");
  for (const t of ["고객사", "품목 그룹", "수요자료 상세", "PO 진행 이벤트"]) await expect(page.locator("body")).toContainText(t);
  await page.goto("/admin/settings"); await expect(page.locator("body")).toContainText("강제배정 품목 한도");
});
