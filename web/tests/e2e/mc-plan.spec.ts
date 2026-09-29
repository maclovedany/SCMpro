import { test, expect } from "@playwright/test";
import { login } from "./helpers";
// 기종(MC) OL · 실적 (R-FC-15 · R-FC-16, D-075 · D-077). 실제 제품군 이름은 스펙에 쓰지 않는다 — 화면에서 읽은 값으로 검증
test("기종 OL · 실적: 메뉴 · KPI · 표 · 실제 이름 · 검색 · 회계연도 전환", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");   // 영업부 — 전 역할이 보는 화면
  await page.getByRole("link", { name: "기종 OL · 실적" }).click();
  await page.waitForURL("**/mc-plan**");
  await expect(page.locator("[data-testid=mc-kpi] a[aria-label$='상세 보기']")).toHaveCount(4);
  await expect(page.getByTestId("mc-chart")).toBeVisible();
  const rows = page.getByTestId("mc-row");
  await expect(rows.first()).toBeVisible();
  const n = await rows.count(); expect(n).toBeGreaterThan(20);
  // 머리글은 회사 파일과 같게, Family = 회사 약자(약자가 없는 몇 개만 익명 이름), Item Code = 익명 코드
  await expect(page.locator("[data-testid=mc-table] thead")).toContainText("Item Code"); await expect(page.locator("[data-testid=mc-table] thead")).toContainText("Family");
  const products = await rows.locator("td:nth-child(3)").allInnerTexts();
  expect(products.filter(p => /MDL\d{3}/.test(p)).length).toBeLessThanOrEqual(3);
  const iots = (await rows.locator("td:nth-child(1)").allInnerTexts()).filter(v => v !== "-");
  expect(iots.length).toBeGreaterThan(20); for (const v of iots) expect(v).toMatch(/^[A-Z0-9][A-Z0-9_-]{5,11}$/);   // 코드 형태 (이름이 아님)
  // 합계 행 = 표시된 행의 합
  await expect(page.getByTestId("mc-total-row")).toContainText(`Family ${n}개`);
  // 소계 = 원본 파일과 같은 두 묶음, 합은 합계와 같다
  const subs = page.getByTestId("mc-subtotal-row");
  await expect(subs).toHaveCount(2);
  await expect(subs.nth(0)).toContainText("DT/GC 소계"); await expect(subs.nth(1)).toContainText("PRINTER 소계");
  const lastNum = async (l: ReturnType<typeof page.getByTestId>) => Number((await l.locator("td").nth(-2).innerText()).replace(/,/g, ""));
  expect(await lastNum(subs.nth(0)) + await lastNum(subs.nth(1))).toBe(await lastNum(page.getByTestId("mc-total-row")));
  // MC 구분별(DT · GC) 내역 = DT/GC 소계
  const biz = page.getByTestId("mc-biz-row");
  await expect(biz).toHaveCount(2);
  expect(await lastNum(biz.nth(0)) + await lastNum(biz.nth(1))).toBe(await lastNum(subs.nth(0)));
  // 전임 · 후속 묶기: 줄 수는 줄고 합계는 같다
  const before = await lastNum(page.getByTestId("mc-total-row"));
  await page.getByTestId("mc-lineage-toggle").click();
  expect(await rows.count()).toBeLessThan(n);
  expect(await lastNum(page.getByTestId("mc-total-row"))).toBe(before);
  await expect(page.getByTestId("mc-lineage").filter({ hasText: "→" }).first()).toBeVisible();
  await page.getByTestId("mc-lineage-toggle").click();
  // 검색: 첫 행의 IOT 로 좁히기
  await page.fill("input[name=mc-search]", iots[0]);
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("mc-total-row")).toContainText("Family 1개");
  await page.fill("input[name=mc-search]", "");
  // 회계연도·구분 전환은 주소에 남는다 (R-UI-01)
  await page.getByTestId("mc-filters").getByRole("link", { name: "FY25" }).click();
  await page.waitForURL(/fy=2025/);
  await page.getByTestId("mc-filters").getByRole("link", { name: "DT", exact: true }).click();
  await page.waitForURL(/biz=DT/);
  await expect(rows.first()).toBeVisible();
  for (const b of await rows.locator("td:nth-child(2)").allInnerTexts()) expect(b).toBe("DT");
  await expect(page.getByRole("button", { name: "내보내기" })).toBeEnabled();
  // Product 를 누르면 기종 예측 비교로
  await rows.locator("td:nth-child(3) a[href^='/forecast/mc']").first().click();   // 기종 묶음이 있는 첫 행
  await page.waitForURL("**/forecast/mc?model=**");
  await expect(page.getByRole("heading", { name: "기종 예측 비교" })).toBeVisible();
});
test("제품군 · 기종으로 보기: 요약 → 품목 목록 → 발주 계획 (D-076)", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "insightcha@daum.net");   // SCM 품목담당자
  // 기종 OL · 실적의 기종 행 → 연결 품목
  await page.goto("/mc-plan");
  await page.getByTestId("mc-row").getByRole("link", { name: "연결 품목" }).first().click();
  await page.waitForURL(/\/items\?model=MDL\d{3}/);
  await expect(page.getByText(/^기종: /)).toBeVisible();
  // 카테고리 표기 = 회사 표기, MC 탭은 DT · GC · PRT 로 거른다 (D-077)
  await expect(page.locator("a.rounded-full").filter({ hasText: /^(SPAREPARTS|CONSUMABLE|OPTION|MC)$/ })).toHaveCount(4);
  await page.locator("a.rounded-full").filter({ hasText: /^MC$/ }).click();
  await page.waitForURL(/category=MC/);
  await expect(page.locator("[data-testid=mc-kpi] a[aria-label$='상세 보기']")).toHaveCount(4);
  const mcRows = page.getByTestId("mc-items").locator("tbody tr");
  await expect(mcRows.first()).toBeVisible();
  await page.getByTestId("mc-biz-tabs").getByRole("link", { name: "PRT", exact: true }).click();
  await page.waitForURL(/biz=PRT/);
  await expect(mcRows.first()).toBeVisible();
  for (const b of await mcRows.locator("td:nth-child(3)").allInnerTexts()) expect(b).toBe("PRT");
  const fam = await mcRows.first().locator("td:nth-child(4)").innerText();
  await mcRows.first().click();
  await page.waitForURL(/\/mc-plan\?.*q=/);
  await expect(page.locator("input[name=mc-search]")).toHaveValue(fam);                       // 그 Family 로 검색된 상태
  await expect(page.getByTestId("mc-row").first()).toContainText(fam);
  await page.goto("/items");
  // 품목 › 제품군 · 기종별 보기
  await page.getByRole("link", { name: "제품군 · 기종별 보기 →" }).click();
  await page.waitForURL("**/items/families**");
  await expect(page.locator("[data-testid=family-kpi] a[aria-label$='상세 보기']")).toHaveCount(4);
  await expect(page.getByTestId("family-chart")).toBeVisible();
  const rows = page.getByTestId("family-table").locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const names = await rows.locator("td:nth-child(1)").allInnerTexts();
  expect(names.filter(v => /MDL\d{3}/.test(v))).toEqual([]);                                  // 실제 이름
  const nItems = Number((await rows.first().locator("td:nth-child(3)").innerText()).replace(/,/g, ""));
  await rows.first().click();
  await page.waitForURL(/\/items\?family=/);
  await expect(page.getByText(/^제품군: /)).toBeVisible();
  await expect(page.getByText(new RegExp(`^${nItems.toLocaleString("ko-KR")}개 ·`))).toBeVisible();   // 요약의 품목 수 = 목록의 품목 수
  await expect(page.locator("input[name=family]")).not.toHaveValue("");
  // 기종별
  await page.goto("/items/families?by=model");
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  await page.waitForURL(/\/items\?model=MDL\d{3}/);
  // 발주 계획: 제품군별 요약 행 → 라인이 그 제품군으로
  await page.goto("/orders");
  await page.locator("[data-testid=op-history] a[href^='/orders/']").first().click();
  const g = page.getByTestId("plan-groups"); await expect(g).toBeVisible({ timeout: 60_000 });
  const total = await page.getByText(/[\d,]+ \/ [\d,]+ 라인/).innerText();
  const gl = Number((await g.locator("tbody tr").first().locator("td:nth-child(3)").innerText()).replace(/,/g, ""));
  await g.locator("tbody tr").first().click();
  await page.waitForURL(/family=/);
  await expect(page.getByText(new RegExp(`/ ${gl.toLocaleString("ko-KR")} 라인`))).toBeVisible({ timeout: 60_000 });
  expect(await page.getByText(/[\d,]+ \/ [\d,]+ 라인/).innerText()).not.toBe(total);
  await g.getByRole("link", { name: "기종별" }).click();
  await page.waitForURL(/by=model/);
  await expect(g.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
});
