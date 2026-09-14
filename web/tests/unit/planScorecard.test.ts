import { it, expect } from "vitest";
import { scorecardInsight, type PlanScorecard } from "@/lib/queries/orders";
const base: PlanScorecard = { scored: 0, last_ym: null, human: { stockout: 0, excess: 0, ok: 0 }, system: { stockout: 0, excess: 0, ok: 0 }, overrides: { n: 0, improved: 0, worsened: 0, same: 0 }, by_category: [], worst: [] };
it("채점 전 안내", () => { expect(scorecardInsight(base)).toContain("채점 전"); });
it("채점 해석 (D-044)", () => {
  const s = { ...base, scored: 100, last_ym: "2026-10", human: { stockout: 5, excess: 5, ok: 90 }, system: { stockout: 12, excess: 3, ok: 85 }, overrides: { n: 20, improved: 8, worsened: 2, same: 10 } };
  expect(scorecardInsight(s)).toBe("100라인 채점 (실적 2026-10 까지): 실제 발주 결품·과잉 10% vs 시스템 제안대로면 15% · 오버라이드 20건 중 개선 8 / 악화 2");
});
