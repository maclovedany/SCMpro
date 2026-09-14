import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { login } from "./helpers";
test.describe.configure({ mode: "serial" });
/** 자율 모드 (D-042): 설정 노출 → 엔진 1회(제안 모드, 규칙 판단) → AI 감시 화면·피드백 → 결재 승인 → 추가수요 반영 → 알림 */
test("AI 감시: 감지 → 제안 → 승인 → 추가수요 반영", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "insightdany@naver.com");
  await page.goto("/admin/settings"); await expect(page.getByTestId("setting-agent_mode")).toContainText("끔");
  // 엔진 실행 (설정은 off 그대로, --mode 로 덮어씀; LLM 없이 규칙 판단)
  const out = execFileSync("uv", ["--directory", "../engine", "run", "engine", "agent", "--mode", "propose", "--no-llm"], { encoding: "utf8", timeout: 180_000 });
  expect(out).toMatch(/'proposed': [1-9]/);
  // AI 감시 화면
  await page.goto("/agent"); await expect(page.getByRole("heading", { name: "AI 감시" })).toBeVisible();
  await expect(page.getByTestId("agent-kpi").locator("a[aria-label$='상세 보기']")).toHaveCount(4);
  const rows = page.locator("[data-testid=agent-row]"); await expect(rows.first()).toBeVisible();
  await page.goto("/agent?status=proposed"); await expect(page.locator("[data-testid=agent-row]").first()).toContainText("제안(승인 대기)");
  await page.locator("[data-testid=agent-row]").first().getByRole("button", { name: "유용" }).click(); await expect(page.getByText("유용함으로 기록")).toBeVisible();
  await page.screenshot({ path: "test-results/agent.png", fullPage: true });
  // 알림 (심각 3 포함 → 팀장에게도 다이제스트)
  await page.context().clearCookies(); await login(page, "upflash@naver.com");
  await page.goto("/notifications?all=1"); await expect(page.getByText(/\[AI 감시\] 조치 필요/).first()).toBeVisible();
  // 결재: AI 감시 발주 제안 승인 → 추가수요 반영
  await page.goto("/approvals?status=pending");
  const row = page.locator("[data-testid=approval-row]").filter({ hasText: "AI 감시 발주 제안" }).first();
  await expect(row).toBeVisible(); await row.getByRole("button", { name: "승인" }).click(); await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("승인했습니다")).toBeVisible();
  await page.goto("/extra-demand"); await expect(page.getByText(/AI 감시 제안 승인/).first()).toBeVisible();
  await page.goto("/agent?status=accepted"); await expect(page.locator("[data-testid=agent-row]").first()).toContainText("승인·반영");
});
