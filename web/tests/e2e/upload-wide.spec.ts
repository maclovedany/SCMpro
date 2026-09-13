import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("과거 연도 출고 실적 — 회사 파일(넓은 형식) 그대로 업로드 → 학습 이력 확장", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/upload");
  await page.selectOption("select[name=target]", "shipment_extra");
  await page.setInputFiles("input[type=file]", "tests/fixtures/shipment_wide_2022.csv");
  await expect(page.getByTestId("wide-detected")).toContainText("월 열 6개: 2022-01 ~ 2022-06");
  await page.selectOption("select[name=wide_item_type]", "PART");
  await page.getByRole("button", { name: "검증" }).click();
  await expect(page.getByText(/정상 1[0-9]건/)).toBeVisible();   // 3품목 × 6개월 − 빈칸/0
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/1분 이내에 갱신/)).toBeVisible();
});
