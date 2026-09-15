import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { login } from "./helpers";

/** 표·템플릿 내보내기 — CSV / Excel (R-UI-05, D-055) */

async function download(page: import("@playwright/test").Page, format: "CSV" | "Excel (.xlsx)") {
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기" }).click();
  await page.getByRole("menuitem", { name: format }).click();
  return wait;
}

test("품목 표를 Excel 로 내보내면 숫자가 숫자 셀로 들어간다", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/items");
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  const dl = await download(page, "Excel (.xlsx)");
  expect(dl.suggestedFilename()).toBe("items.xlsx");
  const wb = XLSX.readFile((await dl.path())!);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  expect(rows.length).toBeGreaterThan(0);

  // 화면 헤더가 한글 그대로 첫 행에 들어간다
  const headers = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0];
  expect(headers.length).toBeGreaterThan(1);
  expect(headers.some(h => /[가-힣]/.test(String(h)))).toBe(true);

  // 숫자 열이 하나 이상 숫자 타입(t === "n") 으로 저장돼 엑셀에서 합계가 된다
  const cells = Object.keys(ws).filter(k => !k.startsWith("!")).map(k => ws[k] as XLSX.CellObject);
  expect(cells.some(c => c.t === "n")).toBe(true);
});

test("품목 표를 CSV 로 내보내면 BOM 이 붙고 검색 결과만 나간다", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/items");
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await page.fill("input[placeholder='검색…']", "556K59129");
  await expect(page.getByText("1행")).toBeVisible();

  const dl = await download(page, "CSV");
  expect(dl.suggestedFilename()).toBe("items.csv");
  const text = readFileSync((await dl.path())!, "utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);          // 엑셀 한글 깨짐 방지 BOM
  expect(text.split("\n")).toHaveLength(2);          // 헤더 + 검색된 1행
  expect(text).toContain("556K59129");
});

test("업로드 템플릿을 xlsx 로 받으면 헤더만 있는 빈 시트가 나온다", async ({ page }) => {
  await login(page, "insightdany@naver.com");
  await page.goto("/upload");
  await page.selectOption("select[name=target]", "inventory_snapshot");

  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "템플릿 다운로드" }).click();
  await page.getByRole("menuitem", { name: "Excel (.xlsx)" }).click();
  const dl = await wait;
  expect(dl.suggestedFilename()).toBe("template-inventory_snapshot.xlsx");

  const wb = XLSX.readFile((await dl.path())!);
  const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  expect(aoa).toHaveLength(1);                       // 헤더 한 줄뿐
  expect(aoa[0]).toContain("품목코드");
});
