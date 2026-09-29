import { test, expect } from "@playwright/test";
import { login } from "./helpers";
test("AI Agent 패널: 열기·리사이즈·질문(도구 호출)·후속 질문·유지·관리자 통계", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "insightdany@naver.com");
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
  await page.context().clearCookies(); await login(page, "insightdany@naver.com");
  await page.goto("/admin/ai-stats");
  await expect(page.locator("a[aria-label$='상세 보기']")).toHaveCount(4);
  await expect(page.locator("[data-testid=ai-log-row]").first()).toBeVisible();
});
test("AI Agent 패널: 다른 계정의 대화가 남아 있어도 새 대화로 답변 · 대화 삭제 (D-072)", async ({ page }) => {
  test.setTimeout(240_000);
  const msgs = page.getByTestId("ai-messages");
  const ask = async (q: string) => { await page.fill("textarea[name=ai-input]", q); await page.keyboard.press("Enter"); await expect(msgs.locator("[data-role=assistant]").last()).not.toContainText("생각 중", { timeout: 120_000 }); };
  // 1) 품목담당자가 대화를 만든다 → 같은 브라우저에 대화 id 가 남는다
  await login(page, "insightcha@daum.net");
  await page.getByTestId("ai-agent-btn").click();
  await page.getByRole("button", { name: "새 대화" }).click();
  await ask("E2E 다음 발주일 언제야?");
  const other = await page.evaluate(() => JSON.parse(localStorage.getItem("scm.aiPanel") ?? "{}").conversationId as string);
  expect(other).toBeTruthy();
  // 2) 같은 브라우저에서 관리자로 로그인 — 남의 대화를 이어 쓰지 않고 새 대화로 답한다
  await page.context().clearCookies(); await login(page, "insightdany@naver.com");
  await expect(page.getByTestId("ai-panel")).toBeVisible();
  await expect(msgs.locator("[data-role=user]")).toHaveCount(0);
  await ask("E2E 기준예측 정확도에 대해서 설명해줘");
  await expect(msgs.locator("[data-role=user]")).toHaveCount(1);
  const answer = await msgs.locator("[data-role=assistant]").last().innerText();
  expect(answer.length).toBeGreaterThan(20); expect(answer).not.toMatch(/^오류/);
  const mine = await page.evaluate(() => JSON.parse(localStorage.getItem("scm.aiPanel") ?? "{}").conversationId as string);
  expect(mine).not.toBe(other);
  await page.reload(); await expect(msgs.locator("[data-role=user]")).toHaveCount(1);   // 저장 확인
  // 3) 대화 목록에는 내 대화만, 삭제하면 목록과 화면에서 사라진다
  await page.getByRole("button", { name: "대화 목록" }).click();
  const row = page.getByTestId("ai-conv-row").filter({ hasText: "E2E 기준예측 정확도" });
  await expect(row).toHaveCount(1);   // 목록 로드 대기
  await expect(page.getByTestId("ai-conv-row").filter({ hasText: "E2E 다음 발주일" })).toHaveCount(0);
  page.on("dialog", d => d.accept());
  await row.getByRole("button", { name: "대화 삭제" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "대화 목록" }).click();
  await expect(msgs.locator("[data-role=user]")).toHaveCount(0);
  // 정리: 품목담당자의 E2E 대화 삭제
  await page.context().clearCookies(); await login(page, "insightcha@daum.net");
  await page.getByRole("button", { name: "대화 목록" }).click();
  const theirs = page.getByTestId("ai-conv-row").filter({ hasText: "E2E 다음 발주일" });
  await expect(theirs.first()).toBeVisible();   // 목록 로드 대기
  for (let n = await theirs.count(); n > 0; n--) { await theirs.first().getByRole("button", { name: "대화 삭제" }).click(); await expect(theirs).toHaveCount(n - 1); }
});
