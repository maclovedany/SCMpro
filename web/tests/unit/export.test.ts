import { it, expect } from "vitest";
import * as XLSX from "xlsx";
import { toCsv, toWorkbook, sheetNameOf, normalizeCell } from "@/lib/export/sheet";

it("quotes CSV text but leaves numbers bare so Excel reads them as numbers", () => {
  const csv = toCsv(["코드", "수량"], [["556K59129", 1200], ["A,B", 0]]);
  expect(csv).toBe('"코드","수량"\n"556K59129",1200\n"A,B",0');
});

it("escapes embedded quotes the CSV way (doubled), not the JSON way", () => {
  expect(toCsv(["설명"], [['12" 트레이'], ["줄\n바꿈"]])).toBe('"설명"\n"12"" 트레이"\n"줄\n바꿈"');
});

it("renders empty cells for null/undefined and keeps 0", () => {
  expect(normalizeCell(null)).toBe("");
  expect(normalizeCell(undefined)).toBe("");
  expect(normalizeCell(0)).toBe(0);
  expect(normalizeCell(1200)).toBe(1200);
  expect(normalizeCell("PART")).toBe("PART");
  expect(normalizeCell(NaN)).toBe("");
});

it("writes numbers as numeric xlsx cells, not text", () => {
  const wb = toWorkbook(["코드", "발주수량", "금액"], [["556K59129", 1200, 3_600_000]], "발주");
  const ws = wb.Sheets["발주"];
  expect(ws.A1.v).toBe("코드");
  expect(ws.A2.t).toBe("s");
  expect(ws.B2.t).toBe("n");
  expect(ws.B2.v).toBe(1200);
  expect(ws.C2.v).toBe(3_600_000);
});

it("sizes columns to the widest cell so 한글 headers are not cut off", () => {
  const wb = toWorkbook(["코드", "카테고리"], [["556K59129", "PART"]], "s");
  const cols = wb.Sheets["s"]["!cols"]!;
  expect(cols[0].wch).toBeGreaterThanOrEqual("556K59129".length);
  expect(cols[1].wch).toBeGreaterThanOrEqual(4);
});

it("sanitizes sheet names to Excel's rules (31 chars, no []:*?/\\)", () => {
  expect(sheetNameOf("order-plan-2026-09")).toBe("order-plan-2026-09");
  expect(sheetNameOf("재고/배정[2026]")).toBe("재고_배정_2026_");
  expect(sheetNameOf("a".repeat(40))).toHaveLength(31);
  expect(sheetNameOf("")).toBe("Sheet1");
});

it("round-trips through a real xlsx buffer", () => {
  const wb = toWorkbook(["품목", "수량"], [["556K59129", 1200]], "재고");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const back = XLSX.read(buf, { type: "array" });
  expect(back.SheetNames).toEqual(["재고"]);
  expect(XLSX.utils.sheet_to_json(back.Sheets["재고"])).toEqual([{ 품목: "556K59129", 수량: 1200 }]);
});
