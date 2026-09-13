import { describe, it, expect } from "vitest";
import { planCharts, planHistory, type PlanOverview, type PlanRow } from "@/lib/queries/orders";
const ov: PlanOverview = {
  by_category: [{ category: "OPTION", n: 10, qty: 100, amount: 6e8, stockout: 2, blocked: 0, flex_hit: 1, ol_base_amount: 5e8, required_amount: 5.5e8 }, { category: "PART", n: 20, qty: 50, amount: 4e8, stockout: 1, blocked: 0, flex_hit: 0, ol_base_amount: 5e8, required_amount: 5.5e8 }],
  by_supplier: [{ supplier: "일본 공장", n: 5, amount: 7e8 }, { supplier: "국내 공급", n: 25, amount: 3e8 }],
  by_need_ym: [{ need_ym: "2026-10", category: "OPTION", n: 8, amount: 5e8 }, { need_ym: "2026-11", category: "OPTION", n: 2, amount: 1e8 }, { need_ym: "2026-10", category: "PART", n: 20, amount: 4e8 }],
  top_items: [{ key_code: "X1", category: "OPTION", qty: 10, amount: 3e8, stockout_risk: true, overridden: false }],
  risk_by_cat_abc: [{ category: "OPTION", abc: "A", n: 2 }, { category: "PART", abc: "C", n: 1 }] };
describe("planCharts (D-035)", () => {
  const c = planCharts(ov);
  it("카테고리 도넛·최대 카테고리·OL 대비 필요량 해석", () => { expect(c.category.data).toEqual([{ name: "OPTION", value: 6e8 }, { name: "PART", value: 4e8 }]); expect(c.category.insight).toContain("OPTION 이 6.0억 (60%)"); expect(c.category.insight).toContain("+10%"); });
  it("필요월 스택은 월×카테고리 0 채움, 첫 달 비중", () => { expect(c.needYm.categories).toEqual(["2026-10", "2026-11"]); expect(c.needYm.series[1].data).toEqual([4e8, 0]); expect(c.needYm.insight).toContain("90%"); });
  it("리스크 카테고리×ABC 0 채움, A 등급 수", () => { expect(c.risk.series[0].data).toEqual([2, 0]); expect(c.risk.insight).toContain("3개 중 A 등급 2개"); });
  it("상위 품목 비중", () => { expect(c.topItems.insight).toContain("30%"); });
});
describe("planHistory", () => {
  const p = (plan_ym: string, status: PlanRow["status"], amount: number, created_at: string): PlanRow => ({ id: plan_ym + status, plan_ym, status, amount, created_at, approved_at: null, summary: { stockout: 1 }, n_lines: 1 });
  it("발주월별 승인 계획 우선, 전월 대비 해석", () => {
    const h = planHistory([p("2026-09", "draft", 100, "b"), p("2026-08", "approved", 80, "a"), p("2026-08", "draft", 999, "a2")]);
    expect(h.x).toEqual(["2026-08", "2026-09"]); expect(h.amount).toEqual([80, 100]); expect(h.insight).toContain("+25%");
  });
});
