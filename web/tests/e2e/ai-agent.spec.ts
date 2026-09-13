import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("AI Agent 패널: 열기·리사이즈·질문(도구 호출)·후속 질문·유지·관리자 통계", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "manager@scm.test");
  await page.getByTestId("ai-agent-btn").click();
  const panel = page.getByTestId("ai-panel"); await expect(panel).toBeVisible();
  const w0 = (await panel.boundingBox())!.width;
  const handle = page.getByTestId("ai-resize-handle"); const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + 1, hb.y + 200); await page.mouse.down(); await page.mouse.move(hb.x - 150, hb.y + 200, { steps: 10 }); await page.mouse.up();
  const w1 = (await panel.boundingBox())!.width; expect(w1).toBeGreaterThan(w0 + 100);
  await page.reload(); await expect(page.getByTestId("ai-panel")).toBeVisible();
  expect(Math.abs((await page.getByTestId("ai-panel").boundingBox())!.width - w1)).toBeLessThan(5);
  // 질문 (실제 gpt-5-nano + 도구)
  await page.fill("textarea[name=ai-input]", "556K59129 품목의 현재고와 DoS, 챔피언 예측 기법을 알려줘");
  await page.keyboard.press("Enter");
  const msgs = page.getByTestId("ai-messages");
  await expect(msgs.locator("[data-role=assistant]").last()).not.toContainText("생각 중", { timeout: 120_000 });
  const answer = await msgs.locator("[data-role=assistant]").last().innerText();
  expect(answer.length).toBeGreaterThan(20); expect(answer).not.toMatch(/^오류/);
  await expect(msgs.getByText(/도구 get_item/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/ai-panel.png" });
  // 후속 질문 (맥락)
  await page.fill("textarea[name=ai-input]", "그 품목의 다음 달 예측값은?");
  await page.keyboard.press("Enter");
  await expect(msgs.locator("[data-role=assistant]").last()).not.toContainText("생각 중", { timeout: 120_000 });
  expect(await msgs.locator("[data-role=user]").count()).toBe(2);
  // 관리자 통계
  await page.context().clearCookies(); await login(page, "admin@scm.test");
  await page.goto("/admin/ai-stats");
  await expect(page.locator("a[aria-label$='상세 보기']")).toHaveCount(4);
  await expect(page.locator("[data-testid=ai-log-row]").first()).toBeVisible();
});
