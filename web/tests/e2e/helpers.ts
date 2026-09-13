import type { Page } from "@playwright/test";
export const PW = process.env.E2E_PASSWORD ?? "Scm!2026test";
/** 실사용 계정 (scripts/seed-users.mts): admin=insightdany@naver.com · scm_lead=upflash@naver.com · sales=insightcha0624@gmail.com · biz_enable=pro-worker@daum.net · marketing=alltest@nate.com · service=imagineworld@kakao.com */
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PW);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
}
