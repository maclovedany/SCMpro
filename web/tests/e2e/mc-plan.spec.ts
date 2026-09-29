import { test, expect } from "@playwright/test";
import { login } from "./helpers";
// 기종 OL · 실적 (R-FC-15, D-075). 실제 제품군 이름은 스펙에 쓰지 않는다 — 화면에서 읽은 값으로 검증
test("기종 OL · 실적: 메뉴 · KPI · 표 · 실제 이름 · 검색 · 회계연도 전환", async ({ page }) => {
  await login(page, "insightcha0624@gmail.com");   // 영업부 — 전 역할이 보는 화면
  await page.getByRole("link", { name: "기종 OL · 실적" }).click();
  await page.waitForURL("**/mc-plan**");
  await expect(page.locator("[data-testid=mc-kpi] a[aria-label$='상세 보기']")).toHaveCount(4);
  await expect(page.getByTestId("mc-chart")).toBeVisible();
  const rows = page.getByTestId("mc-row");
  await expect(rows.first()).toBeVisible();
  const n = await rows.count(); expect(n).toBeGreaterThan(20);
  // Product = 실제 이름(익명 표기 MDLnnn 이 남지 않음), IOT = 익명 코드 그대로
  const products = await rows.locator("td:nth-child(3)").allInnerTexts();
  expect(products.filter(p => /MDL\d{3}/.test(p))).toEqual([]);
  const iots = (await rows.locator("td:nth-child(1)").allInnerTexts()).filter(v => v !== "-");
  expect(iots.length).toBeGreaterThan(20); for (const v of iots) expect(v).toMatch(/^[A-Z0-9][A-Z0-9_-]{5,11}$/);   // 코드 형태 (이름이 아님)
  // 합계 행 = 표시된 행의 합
  await expect(page.getByTestId("mc-total-row")).toContainText(`Product ${n}개`);
  // 검색: 첫 행의 IOT 로 좁히기
  await page.fill("input[name=mc-search]", iots[0]);
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("mc-total-row")).toContainText("Product 1개");
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
  await rows.first().locator("td:nth-child(3) a").click();
  await page.waitForURL("**/forecast/mc?model=**");
  await expect(page.getByRole("heading", { name: "기종 예측 비교" })).toBeVisible();
});
