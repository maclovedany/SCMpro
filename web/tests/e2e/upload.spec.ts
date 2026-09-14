import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("재고 CSV 업로드 → 검증 → 반영 → 상세 반영 → 이력", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/upload");
  await page.selectOption("select[name=target]", "inventory_snapshot");
  await page.setInputFiles("input[type=file]", "tests/fixtures/inventory_sample.csv");
  await expect(page.getByText("2. 컬럼 매핑")).toBeVisible();
  await page.getByRole("button", { name: "검증" }).click();
  await expect(page.getByText("정상 2건")).toBeVisible();
  await expect(page.getByText("오류 1건")).toBeVisible();
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible();
  const card = page.getByTestId("upload-result");
  await expect(card.getByText("성공 1", { exact: true })).toBeVisible();
  await expect(card.getByText("서버 오류 1", { exact: true })).toBeVisible();   // BAD-CODE → UNKNOWN_ITEM
  await page.goto("/items/556K59129");
  await expect(page.locator("#snapshots")).toContainText("2026-09-10");   // 업로드된 스냅샷 행 (더 최신 스냅샷이 있을 수 있음)
  await expect(page.locator("#snapshots")).toContainText("120");
  await page.goto("/upload?tab=log");
  await expect(page.getByText("inventory_sample.csv").first()).toBeVisible();
  await page.screenshot({ path: "test-results/upload-log.png" });
});

test("기종 OL·실적 추가 업로드 → 기종 비교 화면 반영 (D-040)", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/upload");
  await page.selectOption("select[name=target]", "mc_plan_actual");
  await page.setInputFiles("input[type=file]", "tests/fixtures/mc_plan_extra.csv");
  await page.getByRole("button", { name: "검증" }).click();
  await expect(page.getByText("정상 2건")).toBeVisible();
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible();
  await expect(page.getByTestId("upload-result").getByText("성공 2", { exact: true })).toBeVisible();
  await page.goto("/forecast/mc?model=E2E-MDL");
  await expect(page.getByText("E2E-MDL — 월별")).toBeVisible();
  await expect(page.locator("table tbody tr").filter({ hasText: "FY26" })).toContainText("42");   // 실적 합 = 42 (8월은 실적 없음)
});
