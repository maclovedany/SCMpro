import { describe, it, expect } from "vitest";
import { allocationCharts, type AllocationOverview } from "@/lib/queries/allocation";
import { scheduleCharts } from "@/lib/queries/schedule";
describe("allocationCharts (D-036)", () => {
  const ov: AllocationOverview = { alloc_mix: { temp: 120, firm: 1, hold: 0, waiting: 369 }, queue_top: [{ item_code: "556K59129", description: "KIT", shortage: 369, n_orders: 2, available: 149 }],
    expiring: [{ d: "2026-09-20", n: 1, qty: 120 }], inbound_plan: [{ ym: "2026-09", supplier: "일본 공장", qty: 100, n: 2 }, { ym: "2026-10", supplier: "국내 공급", qty: 50, n: 1 }], status_mix: [{ status: "partial", n: 2 }], daily_requests: [{ d: "2026-09-13", n: 3 }] };
  const c = allocationCharts(ov, "2026-09-14");
  it("배정 구성 4조각 + 부족 비중", () => { expect(c.mix.data.map(d => d.name)).toEqual(["임시배정", "확정배정", "승인대기 확보", "배정 대기(부족)"]); expect(c.mix.insight).toContain("75%"); });
  it("만료 예정 31일 축, 해당 일자에 수량", () => { expect(c.expiring.x).toHaveLength(31); expect(c.expiring.values[6]).toBe(120); expect(c.expiring.insight).toContain("7일 내 1건"); });
  it("입고 예정 월×공급처 0 채움", () => { expect(c.inbound.categories).toEqual(["2026-09", "2026-10"]); expect(c.inbound.series.find(s => s.name === "일본 공장")?.data).toEqual([100, 0]); });
  it("대기 상위 품목 해석에 수동 배정 가능 표시", () => { expect(c.queue.insight).toContain("지금 수동 배정 가능"); });
  it("30일 요청 추이 축", () => { expect(c.daily.x).toHaveLength(30); expect(c.daily.x[28].n).toBe(3); });
});
describe("scheduleCharts (D-036)", () => {
  const cal = [{ supplier_name: "일본 공장", ym: "2026-09", order_date: "2026-09-20" }, { supplier_name: "일본 공장", ym: "2026-09", order_date: "2026-09-27" }, { supplier_name: "국내 공급", ym: "2026-10", order_date: "2026-10-05" }];
  const sub = { deadline: "2026-09-29", overdue: false, depts: [{ dept: "sales", submitted: true }, { dept: "marketing", submitted: false }] };
  const gap = { summary: [{ supplier_code: "JP", ym: "2026-08", avg_diff: 2.5 }], rows: [{ diff_days: 3 }, { diff_days: 0 }, { diff_days: -1 }, { diff_days: 2 }] };
  const c = scheduleCharts(cal, sub, gap);
  it("공급처별 회차 스택", () => { expect(c.rounds.categories).toEqual(["2026-09", "2026-10"]); expect(c.rounds.series.find(s => s.name === "일본 공장")?.data).toEqual([2, 0]); expect(c.rounds.insight).toContain("2026-09 발주 2회"); });
  it("제출 진행률", () => { expect(c.submission.pct).toBe(50); expect(c.submission.insight).toContain("1개 부서 미제출"); });
  it("지연/정시/조기 분포", () => { expect(c.dist.data).toEqual([{ name: "지연", value: 2 }, { name: "정시", value: 1 }, { name: "조기", value: 1 }]); expect(c.dist.insight).toContain("JP 2026-08 평균 +2.5일"); });
});
