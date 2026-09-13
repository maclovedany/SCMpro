import { it, expect } from "vitest";
import { autoMap, normalizeRows } from "@/lib/upload/validate";
it("auto-maps korean headers", () => {
  expect(autoMap(["품목코드", "기준일", "수량", "재고구분"], "inventory_snapshot")).toEqual({ item_code: "품목코드", snap_date: "기준일", qty: "수량", stock_class: "재고구분" });
});
it("normalizes and reports row errors", () => {
  const mapping = { item_code: "품목코드", snap_date: "기준일", qty: "수량", stock_class: "재고구분" };
  const rows = [{ 품목코드: "556K59129", 기준일: "2026-09-10", 수량: "120", 재고구분: "normal" }, { 품목코드: "556K59129", 기준일: "2026-09-10", 수량: "abc", 재고구분: "normal" }, { 품목코드: "", 기준일: "2026/09/10", 수량: "1", 재고구분: "x" }];
  const r = normalizeRows(rows, mapping, "inventory_snapshot");
  expect(r.rows).toEqual([{ item_code: "556K59129", snap_date: "2026-09-10", qty: 120, stock_class: "normal" }]);
  expect(r.errors.map(e => e.row)).toEqual([2, 3]);
  expect(r.errors[1].message).toMatch(/품목코드/);
});
it("accepts excel-style dates and numbers with commas", () => {
  const r = normalizeRows([{ 품목코드: "X", 기준일: "2026.09.10", 수량: "1,200" }], { item_code: "품목코드", snap_date: "기준일", qty: "수량" }, "inventory_snapshot");
  expect(r.rows[0]).toEqual({ item_code: "X", snap_date: "2026-09-10", qty: 1200 });
});
