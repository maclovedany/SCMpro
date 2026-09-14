import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("예측 대시보드 · 기종 비교 · 런 상세 · 기법 토글", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/forecast");
  await expect(page.getByRole("heading", { name: "예측" })).toBeVisible();
  await expect(page.getByTestId("fc-kpi").locator("a[aria-label$='상세 보기']")).toHaveCount(4);   // KPI 스트립 (D-034)
  await expect(page.getByText("ABC-XYZ 매트릭스")).toBeVisible();
  await expect(page.getByText("등급별 관리 지침")).toBeVisible();
  for (const id of ["fc-accuracy", "fc-matrix", "fc-grade", "fc-trend"]) await expect(page.getByTestId(id).locator("canvas").first()).toBeVisible();
  await page.screenshot({ path: "test-results/forecast.png", fullPage: true });
  // 관리 지침 셀 드릴다운 → 품목 목록 필터
  await page.locator("a[href='/items?abc=A&xyz=X']").click();
  await expect(page.getByText("ABC A ✕")).toBeVisible();
  // 등급별 재고 카드 드릴다운 (재고 0 · 과잉 필터)
  await page.goto("/items?abc=A&stock=zero"); await expect(page.getByText("재고 0 ✕")).toBeVisible();
  await page.goto("/items?excess=true"); await expect(page.getByText("과잉 (DoS ≥ 목표 2배) ✕")).toBeVisible();
  // 기종 비교
  await page.goto("/forecast/mc?model=MDL213");
  await expect(page.getByText("MDL213 — 월별")).toBeVisible();
  await expect(page.getByText("FY별 정확도")).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toContainText("FY");
  await page.screenshot({ path: "test-results/forecast-mc.png", fullPage: true });
  // 런 목록 → 상세 → AI 제안 존재
  await page.goto("/forecast/runs");
  await page.locator("tbody tr").filter({ hasText: "backtest" }).first().locator("a").click();
  await expect(page.getByText("총계 — 품목/기종")).toBeVisible();
  await expect(page.getByTestId("proposals")).toContainText("진단");
  await expect(page.getByTestId("proposals")).not.toContainText("{");                 // JSON 노출 금지 (D-052)
  await page.getByRole("button", { name: "AI 오차 분석 요청" }).click(); await expect(page.getByText("AI 분석을 요청했습니다")).toBeVisible();
  await expect(page.getByTestId("proposals")).toContainText("분석 대기");
  // 기법 토글 on/off
  await page.goto("/admin/forecast-methods");
  const cb = page.getByLabel("prophet 사용");
  const before = await cb.isChecked();
  await cb.click(); await expect(page.getByText(`Prophet ${before ? "off" : "on"}`)).toBeVisible();
  await page.reload(); await expect(page.getByLabel("prophet 사용")).toBeChecked({ checked: !before });
  await page.getByLabel("prophet 사용").click(); await expect(page.getByText(`Prophet ${before ? "on" : "off"}`)).toBeVisible();
  await page.reload(); await expect(page.getByLabel("prophet 사용")).toBeChecked({ checked: before });
  // 품목 상세 예측
  await page.goto("/items/556K59129");
  await expect(page.getByText("Holt", { exact: true }).first()).toBeVisible();   // 챔피언 기법 카드
  await expect(page.getByText("챔피언 기법").first()).toBeVisible();
  await page.screenshot({ path: "test-results/item-forecast.png", fullPage: true });
});
