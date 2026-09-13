import { it, expect } from "vitest";
import { buildMatrix, accuracyTable, mcSeries } from "@/lib/queries/forecast";
it("builds 3x3 ABC-XYZ matrix with drill hrefs", () => {
  const m = buildMatrix([{ abc: "A", xyz: "X", n_items: 10, value_12m: 100, value_share: 0.5 }, { abc: "C", xyz: "Z", n_items: 3, value_12m: 1, value_share: 0.01 }]);
  expect(m.length).toBe(3); expect(m[0].cells.length).toBe(3);
  expect(m[0].cells[0]).toMatchObject({ abc: "A", xyz: "X", n_items: 10, href: "/items?abc=A&xyz=X" });
  expect(m[2].cells[2].n_items).toBe(3); expect(m[1].cells[1].n_items).toBe(0);
});
it("accuracy table pivots methods vs OL", () => {
  const rows = [{ level: "total", key: "model", method: "champion", wape: 0.31, bias: -0.02 }, { level: "total", key: "model", method: "scm_ol", wape: 0.48, bias: 0.36 }];
  const t = accuracyTable(rows as any, "model");
  expect(t.find(r => r.method === "champion")?.label).toBe("시스템 기준예측");
  expect(t.find(r => r.method === "scm_ol")?.label).toBe("SCM OL");
});
it("mcSeries aligns months and roles", () => {
  const s = mcSeries([{ ym: "2025-04", sales_ol: 10, scm_ol: 12, act: 9, system_fc: 9.5, lower: 8, upper: 11 }, { ym: "2025-05", sales_ol: 11, scm_ol: 13, act: null, system_fc: 10, lower: null, upper: null }] as any);
  expect(s.months).toEqual(["2025-04", "2025-05"]);
  expect(s.series.map(x => x.role)).toEqual(["actual", "sales_ol", "scm_ol", "forecast"]);
  expect(s.series[3].band?.lower).toEqual([8, 10]);   // 밴드 없는 달은 예측값으로 채움
});
