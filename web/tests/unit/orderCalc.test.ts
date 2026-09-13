import { it, expect, describe } from "vitest";
import { computeLine, addMonths, type ItemInput, type Settings } from "@/lib/order/calc";
const S: Settings = { flex_ranges: [{ offset: 1, pct: 20 }, { offset: 2, pct: 30 }, { offset: 3, pct: 30 }], default_lead_time_days: 30, projection_future_months: 6, dos_avg_months: 6 };
const base = (o: Partial<ItemInput> = {}): ItemInput => ({ key_code: "X", category: "PART", avg_6m: 100, on_hand: 50, target_dos_days: 30, moq: 1, unit_price: 10, supplier_id: 1, lead_time_days: 30,
  forecast: { "2026-08": 100, "2026-09": 100, "2026-10": 100, "2026-11": 100 }, inbound: {}, extras: {}, flex_base: {}, ...o });
describe("computeLine (R-OQ)", () => {
  it("addMonths", () => { expect(addMonths("2026-11", 2)).toBe("2027-01"); expect(addMonths("2026-01", -1)).toBe("2025-12"); });
  it("need = plan + lead; required = target + forecast - start (R-OQ-04)", () => {
    // data_last 2026-07, plan 2026-09, lead 1 → need 2026-10. start[2026-10] = 50 -100 -100 = -150 → required = 100(target 30일) + 100 - (-150) = 350
    const l = computeLine(base(), "2026-09", "2026-07", S);
    expect(l.need_ym).toBe("2026-10"); expect(l.lead_months).toBe(1);
    expect(l.start_need).toBe(-150); expect(l.required_qty).toBe(350); expect(l.final_qty).toBe(350); expect(l.stockout_risk).toBe(true);
    expect(l.projection.find(p => p.ym === "2026-08")?.end).toBe(-50);
  });
  it("MOQ ceil 120 → 150 (R-OQ-30)", () => {
    const l = computeLine(base({ on_hand: 280, moq: 50 }), "2026-09", "2026-07", S);   // start need = 280-200=80 → required 100+100-80=120
    expect(l.required_qty).toBe(120); expect(l.final_qty).toBe(150);
  });
  it("flex clamps to ±20% of submitted OL (R-OQ-10/12)", () => {
    const l = computeLine(base({ on_hand: 280, flex_base: { "2026-10": 200 } }), "2026-09", "2026-07", S);  // required 120, range 160..240 → 160
    expect(l.flex_min).toBe(160); expect(l.flex_max).toBe(240); expect(l.chosen_qty).toBe(160); expect(l.flex_hit).toBe(true);
    const h = computeLine(base({ on_hand: 0, flex_base: { "2026-10": 200 } }), "2026-09", "2026-07", S);   // required 400 → clamp 240
    expect(h.chosen_qty).toBe(240); expect(h.flex_hit).toBe(true);
  });
  it("extras add to requirement (R-OQ-20) and inbound reduces (R-INV-02)", () => {
    const l = computeLine(base({ on_hand: 280, extras: { "2026-10": 50 }, inbound: { "2026-09": 100 } }), "2026-09", "2026-07", S);
    expect(l.start_need).toBe(180); expect(l.required_qty).toBe(70);
  });
  it("blocked when target DoS missing (R-OQ-03); dos_after computed", () => {
    expect(computeLine(base({ target_dos_days: null }), "2026-09", "2026-07", S).blocked).toBe(true);
    const l = computeLine(base({ on_hand: 280 }), "2026-09", "2026-07", S);
    expect(l.end_after).toBe(100); expect(l.dos_after).toBe(30);
  });
  it("uses default lead when no supplier", () => {
    expect(computeLine(base({ lead_time_days: null, supplier_id: null }), "2026-09", "2026-07", { ...S, default_lead_time_days: 60 }).lead_months).toBe(2);
  });
});
