import { it, expect } from "vitest";
import { buildSections, sectionsForRole, type DashboardV2 } from "@/lib/queries/dashboard";
const d: DashboardV2 = {
  stock: { expected_end_amount: 1200, target_amount: 1000, current_amount: 5000 }, dos: [{ category: "PART", avg_dos: 20, avg_target: 30, n: 10 }], excess: { n: 3, amount: 2000 },
  risk: { stockout: 5, stockout_a: 1, out_of_stock_with_orders: 0, inbound_delayed: { n: 2, qty: 40 } },
  cycle: { plan: { id: "p1", plan_ym: "2026-09", status: "draft", amount: 500, created_at: "2026-09-13" }, prev_amount: 400, ol_base_amount: 450, next_order: { date: "2026-09-15", supplier: "SUP", eta: "2026-10-01", days: 2 }, submission: { ym: "2026-10", deadline: "2026-09-29", overdue: false, depts: [{ dept: "sales", submitted: false }, { dept: "service", submitted: true }] } },
  forecast: { backtest: { id: "b1", eval_fy: 2025, finished_at: "2026-09-13", model_wape: "0.319", item_wape: "0.323", scm_ol_wape: "0.482", sales_ol_wape: "0.464" }, production: { id: "r1", train_to: "2026-07", finished_at: "2026-09-13", age_days: 0 }, pending_proposals: 1 },
  ops: { approvals: [{ kind: "order_plan", n: 1 }], approvals_total: 1, oldest_pending_hours: 30, expiring_7d: 2, waiting: { n: 2, shortage: 369 } },
  data: { items_by_category: { PART: 1 }, dummy_items: 10, dummy_stock: 10, missing_target_dos: 0, snapshot_date: "2026-09-13", last_upload: null },
};
it("every card has href; tones reflect SCM risk rules", () => {
  const s = buildSections(d); const all = Object.values(s).flatMap(x => x.cards);
  expect(all.length).toBe(18); all.forEach(c => expect(c.href.startsWith("/")).toBe(true));
  expect(s.risk.cards[0].tone).toBe("danger");        // A 등급 품절 위험
  expect(s.risk.cards[0].href).toBe("/orders/p1?risk=true");
  expect(s.cycle.cards[0].tone).toBe("warn");         // 초안인데 발주일 D-2
  expect(s.cycle.cards[2].value).toBe("미제출 1부서");
  expect(s.forecast.cards[0].value).toBe("31.9%"); expect(s.forecast.cards[0].tone).toBe("default");
  expect(s.ops.cards[0].tone).toBe("danger");         // 최장 30시간 대기
  expect(s.stock.cards[1].tone).toBe("warn");         // DoS 20 < 목표 30×0.8
});
it("orders sections by role and appends dummy warning for non-admin", () => {
  expect(sectionsForRole("scm_lead", d).map(x => x.key)).toEqual(["stock", "cycle", "forecast", "risk", "ops", "data-warn"]);
  expect(sectionsForRole("admin", d).map(x => x.key)).toEqual(["risk", "cycle", "stock", "forecast", "ops", "data"]);
  expect(sectionsForRole("sales", d).map(x => x.key)).toEqual(["ops", "risk", "cycle", "data-warn"]);
});
