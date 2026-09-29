import { it, expect } from "vitest";
import { TOOLS, toolSpecs } from "@/lib/ai/tools";
import { SYSTEM_PROMPT } from "@/lib/ai/chat";
import { mcTotalsOf, mcFamilyOf, likeValue, familiesLike } from "@/lib/ai/mcTools";
import { aliasMap } from "@/lib/names";
import type { McOlRow } from "@/lib/queries/mcPlan";
// 합성 값 (D-075 · D-077)
const row = (p: Partial<McOlRow>): McOlRow => ({ model_key: "AL1", model_base: "MDL901", biz: "DT", iot_code: "TL900001", ym: "2026-04", sales_ol: null, scm_ol: null, act: null, product_name: "AL1", codename: "ALPHA", ...p });
const rows = [
  row({ ym: "2026-04", sales_ol: 22, scm_ol: 110, act: 39, successor: "BT2" }), row({ ym: "2026-05", sales_ol: 37, scm_ol: 47, act: 29, successor: "BT2" }),
  row({ model_key: "BT2", product_name: "BT2", iot_code: "TL900002", ym: "2026-04", sales_ol: 44, scm_ol: 94, act: 40, predecessor: "AL1" }),
  row({ model_key: "GC1", product_name: "GC1", biz: "GC", iot_code: "TD900003", ym: "2026-04", sales_ol: 4, scm_ol: 6, act: 1 }),
  row({ model_key: "PR1", product_name: "PR1", biz: "PRT", iot_code: "TL900009", ym: "2026-05", sales_ol: 10, scm_ol: 20, act: 50 }),
];
it("AI Agent has tools for MC families (D-080)", () => {
  const names = TOOLS.map(t => t.name);
  for (const n of ["search_mc_families", "get_mc_family", "get_mc_totals"]) expect(names).toContain(n);
  expect(toolSpecs().length).toBe(TOOLS.length);
  expect(SYSTEM_PROMPT).toContain("search_mc_families"); expect(SYSTEM_PROMPT).toContain("Family");
});
it("totals by MC group and ranking by actuals", () => {
  const t = mcTotalsOf(rows, 2);
  expect(t.months).toEqual(["2026-04", "2026-05"]);
  expect(t.total).toEqual({ families: 4, sales_ol: 117, scm_ol: 277, act: 159, act_vs_sales_ol: 159 / 117 });
  expect(t.groups.map(g => [g.group, g.families, g.act])).toEqual([["DT/GC 소계", 3, 109], ["DT", 2, 108], ["GC", 1, 1], ["PRINTER 소계", 1, 50]]);
  expect(t.top.map(x => [x.family, x.biz, x.act])).toEqual([["AL1", "DT", 68], ["PR1", "PRT", 50]]);           // 실적 큰 순, 요청한 개수만
  expect(t.top[0]).toMatchObject({ item_code: "TL900001", sales_ol: 59, scm_ol: 157, successor: "BT2" });
  expect(mcTotalsOf(rows, 10, "PRT").top.map(x => x.family)).toEqual(["PR1"]);
});
it("one family: months, total and lineage", () => {
  const f = mcFamilyOf(rows, "AL1");
  expect(f).toMatchObject({ family: "AL1", biz: "DT", item_code: "TL900001", machine: "ALPHA", predecessor: null, successor: "BT2" });
  expect(f!.months).toEqual([{ ym: "2026-04", sales_ol: 22, scm_ol: 110, act: 39, act_vs_sales_ol: 39 / 22 }, { ym: "2026-05", sales_ol: 37, scm_ol: 47, act: 29, act_vs_sales_ol: 29 / 37 }]);
  expect(f!.total).toEqual({ sales_ol: 59, scm_ol: 157, act: 68, act_vs_sales_ol: 68 / 59 });
  expect(mcFamilyOf(rows, "al1")!.family).toBe("AL1");                                                           // 대소문자 무시
  expect(mcFamilyOf(rows, "없는 이름")).toBeNull();
});
it("search values are quoted for the filter, family names are matched by display name", () => {
  expect(likeValue("Alpha(100), B")).toBe('"%Alpha(100), B%"'); expect(likeValue('a"b')).toBe('"%a\\"b%"');
  const m = aliasMap([{ kind: "family", anon: "MDL901 LOW", anon_key: "MDL901 LOW", real_name: "ALPHA LOW" }, { kind: "family", anon: "MDL902 MID", anon_key: "MDL902 MID", real_name: "BETA MID" }]);
  expect(familiesLike(m, "alpha")).toEqual(["MDL901 LOW"]); expect(familiesLike(m, "zzz")).toEqual([]); expect(familiesLike(m, "")).toEqual([]);
});
