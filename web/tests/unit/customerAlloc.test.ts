import { describe, it, expect } from "vitest";
import { customerAllocSummary, customerAllocCharts, maxForceQty, forcePoolSummary, type CustAllocRow, type ForcePoolRow } from "@/lib/queries/customers";
const row = (o: Partial<CustAllocRow>): CustAllocRow => ({ customer_code: "C1", customer_name: "가온금융", segment: "금융", is_strategic: false, item_code: "TC1", description: "기기 A", item_type: "MACHINE",
  need_qty: 10, has_demand_line: true, depts: "sales", order_qty: 10, n_orders: 1, temp_qty: 0, firm_qty: 0, hold_qty: 0, forced_qty: 0, allocated_qty: 0, shortage_qty: 10, fill_rate: 0, available: 0, is_dummy: true, ...o });
describe("고객사별 배정현황 (R-AL-52)", () => {
  const rows = [row({ allocated_qty: 6, shortage_qty: 4, fill_rate: 0.6 }), row({ item_code: "TC2", description: "기기 B", need_qty: 5, allocated_qty: 5, shortage_qty: 0, fill_rate: 1 }),
    row({ customer_code: "C2", customer_name: "누리대학교", need_qty: 20, allocated_qty: 0, shortage_qty: 20, is_strategic: true })];
  it("요약: 필요·배정·부족·충족률·부족 고객사 수", () => {
    const s = customerAllocSummary(rows);
    expect(s).toMatchObject({ customers: 2, need: 35, allocated: 11, shortage: 24, shortCustomers: 2 });
    expect(s.fillRate).toBeCloseTo(11 / 35, 5);
    expect(s.byCustomer.map(c => c.code)).toEqual(["C2", "C1"]);              // 부족 큰 순
    expect(s.byCustomer[1]).toMatchObject({ need: 15, allocated: 11, shortage: 4 });
    expect(s.topItems[0]).toMatchObject({ item_code: "TC1", shortage: 24 });  // 품목별 부족 합
  });
  it("배정이 필요를 넘으면 충족률은 100% 로 자른다", () => {
    const s = customerAllocSummary([row({ need_qty: 4, allocated_qty: 9, shortage_qty: 0 })]);
    expect(s.allocated).toBe(4); expect(s.fillRate).toBe(1);
  });
  it("빈 입력", () => { const s = customerAllocSummary([]); expect(s.customers).toBe(0); expect(s.fillRate).toBeNull(); expect(customerAllocCharts(s).bars.categories).toEqual([]); });
  it("차트: 고객사별 배정·부족 누적 막대 + 한 줄 해석", () => {
    const c = customerAllocCharts(customerAllocSummary(rows));
    expect(c.bars.categories).toEqual(["누리대학교", "가온금융"]);
    expect(c.bars.series).toEqual([{ name: "배정", data: [0, 11] }, { name: "부족", data: [20, 4] }]);
    expect(c.bars.insight).toContain("누리대학교"); expect(c.items.labels[0]).toContain("TC1");
  });
});
describe("강제배정 한도 (R-AL-53)", () => {
  const p = (o: Partial<ForcePoolRow>): ForcePoolRow => ({ order_id: "o1", order_no: "SO-1", item_code: "TC1", description: "기기 A", item_type: "MACHINE", customer_code: "C1", customer_name: "가온금융", is_strategic: true,
    qty: 10, status: "waiting", priority: 100, requested_at: "2026-09-17", is_dummy: true, shortage: 8, order_forced_qty: 0, available: 20, on_hand: 40, customer_need: 12, depts: "sales",
    customer_forced_qty: 0, item_forced_qty: 0, item_quota: 12, quota_pct: 30, ...o });
  it("최대 수량 = min(부족, 가용, 품목 한도 잔여, 고객사 필요 잔여)", () => {
    expect(maxForceQty(p({}))).toBe(8);
    expect(maxForceQty(p({ available: 3 }))).toBe(3);
    expect(maxForceQty(p({ item_forced_qty: 10 }))).toBe(2);
    expect(maxForceQty(p({ customer_need: 5, customer_forced_qty: 4 }))).toBe(1);
    expect(maxForceQty(p({ customer_need: null }))).toBe(8);                 // 수요 라인이 없으면 고객사 한도 없음
    expect(maxForceQty(p({ item_forced_qty: 12 }))).toBe(0);
  });
  it("품목별 한도 사용 요약", () => {
    const s = forcePoolSummary([p({}), p({ order_id: "o2", shortage: 2 }), p({ order_id: "o3", item_code: "TC2", item_quota: 6, item_forced_qty: 6, available: 5 })]);
    expect(s.orders).toBe(3); expect(s.eligible).toBe(2); expect(s.pct).toBe(30);
    expect(s.items).toEqual([{ item_code: "TC1", description: "기기 A", quota: 12, used: 0, remaining: 12, available: 20, orders: 2 }, { item_code: "TC2", description: "기기 A", quota: 6, used: 6, remaining: 0, available: 5, orders: 1 }]);
  });
});
