import { it, expect } from "vitest";
import { ratioOf, mcPivot, fyOf, fyLabel, type McOlRow } from "@/lib/queries/mcPlan";
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
    row({ ym: "2026-05", sales_ol: 37, scm_ol: 47, act: 29 }), row({ ym: "2026-04", sales_ol: 22, scm_ol: 110, act: 39 }),
    row({ model_key: "MDL902 B", model_base: "MDL902", biz: "GC", iot_code: "TD000002", product_name: "Beta B", codename: "BETA", ym: "2026-04", sales_ol: 0, scm_ol: 2, act: 1 }),
    row({ model_key: "MDL900 Z", model_base: "MDL900", biz: "DT", iot_code: null, product_name: "Zeta", codename: "ZETA", ym: "2026-05", sales_ol: 3, scm_ol: null, act: null }),
  ]);
  expect(p.months).toEqual(["2026-04", "2026-05"]);
  expect(p.lines.map(l => l.product)).toEqual(["Alpha A", "Zeta", "Beta B"]);                 // 구분(DT → GC → PRT) → IOT → Product, IOT 없는 행은 뒤
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
