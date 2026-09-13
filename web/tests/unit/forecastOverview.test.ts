import { describe, it, expect } from "vitest";
import { overviewCharts, GRADE_GUIDE, type ForecastOverview } from "@/lib/queries/forecast";
const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
const ov: ForecastOverview = {
  matrix: [{ abc: "A", xyz: "X", n_items: 10, value_share: 0.5, stock_value: 100, avg_dos: 30 }, { abc: "C", xyz: "Z", n_items: 90, value_share: 0.02, stock_value: 5, avg_dos: 10 }],
  grade: [{ abc: "A", n_items: 10, stock_value: 100, avg_dos: 40, target_dos: 30, excess: 2, stockout: 1 }, { abc: "C", n_items: 90, stock_value: 5, avg_dos: 10, target_dos: 30, excess: 0, stockout: 50 }],
  trend: months.flatMap(ym => [{ ym, category: "PART", qty: 100 }, { ym, category: "SUPPLY", qty: months.indexOf(ym) >= 9 ? 400 : 200 }]),
  champion: [{ method: "baseline6", n: 70 }, { method: "sba", n: 30 }], last_ym: "2025-12" };
describe("overviewCharts (D-034)", () => {
  const c = overviewCharts(ov);
  it("히트맵 3×3 셀, 빈 셀은 0", () => { expect(c.heat.cells).toHaveLength(9); expect(c.heat.cells.find(x => x.x === 0 && x.y === 0)?.value).toBe(0.5); expect(c.heat.cells.find(x => x.x === 1 && x.y === 1)?.value).toBe(0); expect(c.heat.insight).toContain("AX"); });
  it("등급은 A/B/C 순, 없는 등급은 0 채움", () => { expect(c.grade.map(g => g.abc)).toEqual(["A", "B", "C"]); expect(c.grade[1].n_items).toBe(0); expect(c.gradeValue.insight).toContain("95%"); });
  it("DoS 초과 등급을 해석에 표시", () => { expect(c.gradeDos.insight).toContain("A 등급"); expect(c.gradeDos.insight).toContain("2개"); });
  it("추이는 12개월 × 3 카테고리(OPTION 0 채움), 최근 3M vs 직전 9M 해석", () => { expect(c.trend.x).toHaveLength(12); expect(c.trend.series.map(s => s.name)).toEqual(["PART", "SUPPLY", "OPTION"]); expect(c.trend.series[2].data.every(v => v === 0)).toBe(true); expect(c.trend.insight).toContain("SUPPLY +100%"); });
  it("챔피언 분포 라벨·키 대응", () => { expect(c.champion.labels[0]).toBe("6M 평균"); expect(c.champion.keys[0]).toBe("baseline6"); expect(c.champion.insight).toContain("70%"); });
  it("관리 지침은 9셀 전부", () => { expect(Object.keys(GRADE_GUIDE)).toHaveLength(9); });
});
