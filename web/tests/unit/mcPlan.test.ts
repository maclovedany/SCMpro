import { it, expect } from "vitest";
import { ratioOf, mcPivot, mcSummary, mcLineage, fyOf, fyLabel, type McOlRow } from "@/lib/queries/mcPlan";
import { parseFamilyFilters, byModel, inList, type FamilySummaryRow } from "@/lib/queries/families";
import { menuForRole } from "@/lib/auth/roles";
// 합성 값 — 실제 제품군 이름은 테스트에 쓰지 않는다 (D-075)
const row = (p: Partial<McOlRow>): McOlRow => ({ model_key: "MDL901 A", model_base: "MDL901", biz: "DT", iot_code: "TL000001", ym: "2026-04", sales_ol: null, scm_ol: null, act: null, product_name: "Alpha A", codename: "ALPHA", ...p });
it("ratio = 실적 ÷ Sales OL, OL 이 0 이거나 없으면 값 없음", () => {
  expect(ratioOf(39, 22)).toBeCloseTo(1.7727, 3); expect(ratioOf(0, 10)).toBe(0);
  expect(ratioOf(1, 0)).toBeNull(); expect(ratioOf(null, 10)).toBeNull(); expect(ratioOf(5, null)).toBeNull();
});
it("fiscal year starts in April", () => { expect(fyOf("2026-03")).toBe(2025); expect(fyOf("2026-04")).toBe(2026); expect(fyLabel(2026)).toBe("FY26"); });
it("pivots rows into product lines by month with totals", () => {
  const p = mcPivot([
    row({ ym: "2026-05", sales_ol: 37, scm_ol: 47, act: 29, sort_no: 1 }), row({ ym: "2026-04", sales_ol: 22, scm_ol: 110, act: 39, sort_no: 1 }),
    row({ model_key: "MDL902 B", model_base: "MDL902", biz: "GC", iot_code: "TD000002", product_name: "Beta B", codename: "BETA", ym: "2026-04", sales_ol: 0, scm_ol: 2, act: 1, sort_no: 3 }),
    row({ model_key: "MDL900 Z", model_base: "MDL900", biz: "DT", iot_code: null, product_name: "Zeta", codename: "ZETA", ym: "2026-05", sales_ol: 3, scm_ol: null, act: null, sort_no: 2 }),
  ]);
  expect(p.months).toEqual(["2026-04", "2026-05"]);
  expect(p.lines.map(l => l.product)).toEqual(["Alpha A", "Zeta", "Beta B"]);                 // 묶음(DT/GC → PRINTER) → 회사 파일 순서 → Item Code
  const a = p.lines[0];
  expect(a.iot).toBe("TL000001"); expect(a.cells[0]).toEqual({ sales_ol: 22, scm_ol: 110, act: 39, ratio: 39 / 22 });
  expect(a.total).toEqual({ sales_ol: 59, scm_ol: 157, act: 68, ratio: 68 / 59 });
  expect(p.lines[1].cells[0]).toEqual({ sales_ol: null, scm_ol: null, act: null, ratio: null });   // 값 없는 달
  expect(p.lines[2].cells[0].ratio).toBeNull();                                                     // Sales OL 0
  expect(p.total.cells[0]).toEqual({ sales_ol: 22, scm_ol: 112, act: 40, ratio: 40 / 22 });
  expect(p.total.total).toEqual({ sales_ol: 62, scm_ol: 159, act: 69, ratio: 69 / 62 });
  expect(p.activeProducts).toBe(2);
});
it("filters by business line", () => {
  const p = mcPivot([row({ sales_ol: 1, act: 1 }), row({ model_key: "B", biz: "GC", sales_ol: 2, act: 2 })], "GC");
  expect(p.lines.length).toBe(1); expect(p.total.total.act).toBe(2);
});
it("menu has the machine OL screen in the plan group for every role", () => {
  for (const r of ["sales", "marketing", "item_manager", "admin"] as const) expect(menuForRole(r).some(m => m.href === "/mc-plan")).toBe(true);
});
it("summary has grand total and the two subtotals of the source file", () => {
  const p = mcPivot([
    row({ ym: "2026-04", sales_ol: 22, scm_ol: 110, act: 39 }),
    row({ model_key: "G", biz: "GC", iot_code: "TD1", ym: "2026-04", sales_ol: 4, scm_ol: 6, act: 1 }),
    row({ model_key: "P", biz: "PRT", iot_code: "TL9", ym: "2026-04", sales_ol: 10, scm_ol: 20, act: 5 }),
    row({ model_key: "N", biz: null, iot_code: null, ym: "2026-04", sales_ol: 1, scm_ol: 1, act: 1 }),
  ]);
  const s = mcSummary(p.months, p.lines);
  expect(s.total.total).toEqual({ sales_ol: 37, scm_ol: 137, act: 46, ratio: 46 / 37 }); expect(s.total.n).toBe(4);
  expect(s.groups.map(g => [g.label, g.n, g.total.act])).toEqual([["DT/GC 소계", 2, 40], ["DT", 1, 39], ["GC", 1, 1], ["PRINTER 소계", 1, 5]]);   // 구분 없는 행은 합계에만. DT · GC 는 DT/GC 의 내역
  expect(s.groups[0].cells[0]).toEqual({ sales_ol: 26, scm_ol: 116, act: 40, ratio: 40 / 26 });
  expect(mcSummary(p.months, p.lines.filter(l => l.biz === "PRT")).groups.map(g => g.label)).toEqual(["PRINTER 소계"]);   // 행이 없는 묶음은 내지 않는다
  expect(mcSummary(p.months, p.lines.filter(l => l.biz === "DT")).groups.map(g => g.label)).toEqual(["DT/GC 소계", "DT"]);
});
it("family filters come from the address, machine code is normalised", () => {
  expect(parseFamilyFilters({ family: " Alpha A ", model: "mdl901" })).toEqual({ family: "Alpha A", model: "MDL901" });
  expect(parseFamilyFilters({ family: "", model: undefined })).toEqual({});
});
it("groups family summary rows by category into one line per key", () => {
  const r = (p: Partial<FamilySummaryRow>): FamilySummaryRow => ({ key: "MDL901 A", name: "Alpha A", category: "PART", n_items: 1, on_hand: 0, inbound_qty: 0, avg_6m: 0, total_12m: 0, n_zero_stock: 0, n_below_target: 0, ...p });
  const g = byModel([r({ n_items: 2, on_hand: 30, avg_6m: 10, total_12m: 100, n_zero_stock: 1 }), r({ category: "SUPPLY", n_items: 3, on_hand: 60, avg_6m: 20, total_12m: 50 }), r({ key: "B", name: "Beta", n_items: 1, avg_6m: 0 })]);
  expect(g.map(x => x.key)).toEqual(["MDL901 A", "B"]);                                  // 12개월 출고 큰 순
  expect(g[0]).toMatchObject({ name: "Alpha A", categories: "SPAREPARTS · CONSUMABLE", n_items: 5, on_hand: 90, avg_6m: 30, total_12m: 150, n_zero_stock: 1, dos_days: 90 });
  expect(g[1].dos_days).toBeNull();
});
it("quotes names for the in-list filter", () => {
  expect(inList(["Alpha A(100-200)", 'Beta 65"', "G,1"])).toBe('("Alpha A(100-200)","Beta 65\\"","G,1")');
});
it("keeps the order of the company file inside each group", () => {
  const p = mcPivot([row({ model_key: "B", product_name: "B", iot_code: "TL1", sort_no: 2, act: 1 }), row({ model_key: "A", product_name: "A", iot_code: "TL9", sort_no: 1, act: 1 }),
    row({ model_key: "P", product_name: "P", biz: "PRT", sort_no: 0, act: 1 }), row({ model_key: "G", product_name: "G", biz: "GC", sort_no: 5, act: 1 })]);
  expect(p.lines.map(l => l.product)).toEqual(["A", "B", "G", "P"]);
});
it("joins predecessor and successor into one line", () => {
  const p = mcPivot([
    row({ model_key: "AL1", product_name: "AL1", ym: "2025-04", sales_ol: 10, scm_ol: 12, act: 8, successor: "BT2" }),
    row({ model_key: "BT2", product_name: "BT2", ym: "2025-05", sales_ol: 20, scm_ol: 22, act: 18, predecessor: "AL1" }),
    row({ model_key: "BT2", product_name: "BT2", ym: "2025-04", sales_ol: 1, scm_ol: 1, act: 1, predecessor: "AL1" }),
    row({ model_key: "SOLO", product_name: "SOLO", ym: "2025-04", sales_ol: 5, scm_ol: 5, act: 5, predecessor: "GONE" }),      // 전임기가 표에 없으면 그대로
  ]);
  const l = mcLineage(p.lines);
  expect(l.map(x => x.product)).toEqual(["BT2", "SOLO"]);
  expect(l[0].members).toEqual(["AL1", "BT2"]); expect(l[0].key).toBe("BT2");
  expect(l[0].cells.map(c => c.act)).toEqual([9, 18]); expect(l[0].total).toEqual({ sales_ol: 31, scm_ol: 35, act: 27, ratio: 27 / 31 });
  expect(l[1].members).toEqual(["SOLO"]);
  expect(mcSummary(p.months, l).total.total.act).toBe(mcSummary(p.months, p.lines).total.total.act);                          // 묶어도 합계는 같다
});
