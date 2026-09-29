import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { helpTerms, searchHelp, searchMenus, menusFor } from "@/lib/ai/help";
import { HELP } from "@/lib/ai/helpData";
it("splits a question into search terms, also without the trailing particle", () => {
  expect(helpTerms("강제 배정은 어디서 해?")).toEqual(expect.arrayContaining(["강제", "배정은", "배정", "어디서"]));
  expect(helpTerms("WAPE가 뭐야")).toEqual(expect.arrayContaining(["wape가", "wape"]));
  expect(helpTerms("?")).toEqual([]);
});
it("finds guide sections and glossary terms", () => {
  const e = [{ id: 1, kind: "guide" as const, title: "사업강화부 — 강제 배정", text: "품목 한도 잔여 안에서 주문에 강제로 배정한다" }, { id: 2, kind: "term" as const, title: "DoS (Day of Sales)", text: "월말재고 ÷ 월평균사용량 × 30" }, { id: 3, kind: "guide" as const, title: "영업부", text: "주문을 등록한다" }];
  expect(searchHelp("강제배정 한도가 뭐야", 4, e)[0].title).toBe("사업강화부 — 강제 배정");
  expect(searchHelp("DoS 가 뭐야", 4, e)[0]).toMatchObject({ title: "DoS (Day of Sales)", kind: "용어" });
  expect(searchHelp("전혀없는말", 4, e)).toEqual([]);
});
it("real help data answers common questions", () => {
  expect(HELP.length).toBeGreaterThan(50);
  expect(searchHelp("Flex 범위가 뭐야")[0].title).toContain("Flex");
  expect(searchHelp("긴급발주는 어떻게 요청해").some(h => h.title.includes("긴급발주"))).toBe(true);
  expect(JSON.stringify(HELP)).not.toMatch(/@[a-z]+\.(com|net)/);                       // 계정 이메일은 넣지 않는다
});
it("tells where a menu is and who can see it", () => {
  const m = searchMenus("강제 배정은 어디서 해?", "sales");
  expect(m.find(x => x.path === "/allocation/force")).toMatchObject({ menu: "강제 배정", group: "운영", visible_to_you: false });
  expect(searchMenus("강제 배정", "biz_enable").find(x => x.path === "/allocation/force")!.visible_to_you).toBe(true);
  expect(menusFor("sales").some(x => x.path === "/admin/settings")).toBe(false);
});
it("help data is in sync with the docs", async () => {
  const root = path.resolve(__dirname, "../../..");
  const { build } = await import("../../scripts/gen-help.mjs" as string) as { build: (g: string, t: string) => unknown[] };
  expect(HELP).toEqual(build(fs.readFileSync(path.join(root, "docs/08-user-guide.md"), "utf8"), fs.readFileSync(path.join(root, "docs/00-glossary.md"), "utf8")));
});
