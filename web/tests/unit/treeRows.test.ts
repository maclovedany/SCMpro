import { it, expect } from "vitest";
import { buildTreeRows } from "@/lib/queries/orders";
it("재고전개 행: 기초 + 입고 − 예측 − 추가 + 발주 = 기말 (D-050)", () => {
  const months = ["2026-10", "2026-11"];
  const proj = [{ ym: "2026-10", forecast: 20, inbound: 5, extras: 3, start: 30, end: 12, order: 0 }, { ym: "2026-11", forecast: 20, inbound: 0, extras: 0, start: 12, end: 42, order: 50 }];
  const rows = buildTreeRows({ PART: { "2026-10": { forecast: 20, inbound: 5, extras: 3, end: 12, order: 0, final: 0, n: 1 } } },
    [{ key_code: "X1", category: "PART", projection: proj as never, final_qty: 50, override_qty: null, need_ym: "2026-11" }], months);
  const cat = rows[0]; expect(cat.label).toBe("PART (1) — 기말재고 합"); expect(cat.values["2026-10"]).toBe(12);
  const item = cat.children!.find(r => r.id === "it-X1")!; expect(item.values).toEqual({ "2026-10": 12, "2026-11": 42 });
  const byId = Object.fromEntries(item.children!.map(r => [r.id, r]));
  expect(byId["it-X1-fc"].values["2026-10"]).toBe(-20); expect(byId["it-X1-ex"].values["2026-10"]).toBe(-3); expect(byId["it-X1-ex"].values["2026-11"]).toBe(0);
  expect(byId["it-X1-ord"].editable).toBe(true); expect(byId["it-X1-ord"].values).toEqual({ "2026-10": null, "2026-11": 50 });
  // 열 세로 합: 기초 + 입고 + (−예측) + (−추가) + 발주 = 기말
  const m = "2026-11"; const sum = byId["it-X1-st"].values[m]! + byId["it-X1-inb"].values[m]! + byId["it-X1-fc"].values[m]! + byId["it-X1-ex"].values[m]! + byId["it-X1-ord"].values[m]!;
  expect(sum).toBe(byId["it-X1-end"].values[m]);
  expect(item.children!.map(r => r.label)).toEqual(["기초", "＋ 입고예정", "− 예측 판매", "− 추가수요", "＋ 확정 발주", "＝ 기말"]);
});
