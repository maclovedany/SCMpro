import { test, expect } from "@playwright/test";
import { login } from "./helpers";
/** R-UI-02: 메뉴 전환 체감 1초 이내. 클라이언트 네비게이션(사이드바 클릭) 기준으로 측정 */
const ROUTES = [["/items", "품목"], ["/notifications", "알림"], ["/upload", "데이터 업로드"], ["/approvals", "승인함"], ["/admin/item-settings", "품목 설정"], ["/sales-orders", "영업 주문"], ["/allocation", "재고 배정"], ["/orders", "발주 계획"], ["/forecast", "예측"], ["/dashboard", "대시보드"]] as const;
test("메뉴 전환 < 1000ms", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  // 워밍업 (프리페치 + 첫 컴파일)
  for (const [href] of ROUTES) { await page.goto(href); await page.locator("main h1").first().waitFor(); }
  await page.goto("/dashboard"); await page.locator("main h1").first().waitFor();
  const results: { route: string; ms: number }[] = [];
  for (const [href, label] of ROUTES) {
    const t0 = Date.now();
    await page.locator("nav[aria-label='주 메뉴']").getByRole("link", { name: label, exact: true }).click();
    await page.waitForURL(`**${href}`);
    await page.locator("main h1").first().waitFor();   // 본문 렌더 완료 = 체감 전환
    results.push({ route: href, ms: Date.now() - t0 });
  }
  console.table(results);
  for (const r of results) expect(r.ms, `${r.route} 전환 ${r.ms}ms`).toBeLessThan(1000);
});
