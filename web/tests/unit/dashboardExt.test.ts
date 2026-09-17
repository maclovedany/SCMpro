import { describe, it, expect } from "vitest";
import { extSections, extCharts, mergeSections, type DashboardExt } from "@/lib/queries/dashboardExt";
const x: DashboardExt = {
  inventory: { snapshot_date: "2026-09-14", n_items: 900, zero_stock: 40, zero_available: 12, low_dos: 30,
    by_cat: [{ category: "PART", on_hand: 1000, allocated: 100, available: 900, n_items: 500 }, { category: "MACHINE", on_hand: 200, allocated: 150, available: 50, n_items: 12 }] },
  groups: [{ group_code: "PAPER", group_name: "용지", owner_dept: "marketing", is_dummy: true, n_items: 10, on_hand: 300, available: 280, zero_available: 2,
    items: [{ item_code: "P1", description: "A4 용지", on_hand: 0, available: 0, dos_days: null }, { item_code: "P2", description: "롤 용지", on_hand: 50, available: 40, dos_days: 12 }] }],
  urgent: { open: 5, delayed: 1, pending_approval: 0, received_30d: 1, mine_open: 2, stages: [{ stage: "approved", n: 1 }, { stage: "shipped", n: 2 }, { stage: "received", n: 1 }],
    recent: [{ id: "u1", item_code: "CT1", description: "토너 K", qty: 50, stage: "shipped", delayed: true, planned_date: "2026-09-13", need_date: "2026-09-13", requested_dept: "service", po_no: "PO-U0006" }] },
  customer: { customers: 10, need: 300, allocated: 180, shortage: 120, short_customers: 7, top: [{ customer_code: "C2", customer_name: "누리대학교", need: 45, allocated: 16, shortage: 29 }] },
};
describe("대시보드 확장 묶음 (R-UI-16)", () => {
  it("재고 현황은 전 역할의 맨 위", () => {
    for (const r of ["sales", "marketing", "service", "biz_enable", "item_manager", "scm_lead", "admin"] as const) expect(extSections(r, x).top[0].key).toBe("inv");
  });
  it("담당 품목 재고는 그룹이 있을 때만, 마케팅은 위쪽", () => {
    expect(extSections("marketing", x).top.map(s => s.key)).toEqual(["inv", "mygroup"]);
    expect(extSections("marketing", { ...x, groups: [] }).top.map(s => s.key)).toEqual(["inv"]);
    expect(extSections("sales", x).top.map(s => s.key)).toEqual(["inv", "custalloc"]);
    expect(extSections("service", x).top.map(s => s.key)).toEqual(["inv", "urgent", "mygroup"]);
    expect(extSections("scm_lead", x).bottom.map(s => s.key)).toEqual(["urgent", "custalloc", "mygroup"]);
  });
  it("모든 카드는 드릴다운 href 가 있고 3장씩", () => {
    const all = [...extSections("admin", x).top, ...extSections("admin", x).bottom];
    expect(all.every(s => s.cards.length === 3 && s.cards.every(c => c.href.startsWith("/")))).toBe(true);
  });
  it("경고 톤: 지연 있으면 긴급 danger, 부족 고객사 있으면 warn", () => {
    const s = extSections("service", x).top.find(s => s.key === "urgent")!;
    expect(s.cards.find(c => c.label.includes("지연"))?.tone).toBe("danger");
    expect(extSections("sales", x).top.find(s => s.key === "custalloc")!.cards.find(c => c.label.includes("부족"))?.tone).toBe("warn");
  });
  it("차트 데이터와 한 줄 해석", () => {
    const c = extCharts(x);
    expect(c.inv.categories).toEqual(["MACHINE", "PART"]); expect(c.inv.series.map(s => s.name)).toEqual(["가용", "배정"]);
    expect(c.inv.insight).toContain("MACHINE");                                 // 배정 비중이 가장 높은 카테고리
    expect(c.inv.series[1].data).toEqual([75, 10]);                              // 수량이 아니라 카테고리 안 비율(%) — 작은 카테고리도 보이게
    expect(c.inv.insight).toContain("PART 1,000");
    expect(c.urgent.labels.length).toBe(8); expect(c.urgent.values[3]).toBe(2);  // shipped
    expect(c.custalloc.categories).toEqual(["누리대학교"]); expect(c.mygroup.labels[0]).toContain("P1");
  });
  it("기존 섹션 앞뒤로 합친다", () => {
    const base = [{ key: "risk", title: "t", cards: [], accent: "risk" as const }];
    expect(mergeSections(extSections("sales", x), base).map(s => s.key)).toEqual(["inv", "custalloc", "risk", "urgent"]);
  });
});
