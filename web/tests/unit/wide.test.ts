import { it, expect } from "vitest";
import { headerToYm, detectWide, wideToLong } from "@/lib/upload/wide";
it("parses month headers in company formats", () => {
  expect(headerToYm("07-2026")).toBe("2026-07"); expect(headerToYm("2026-7")).toBe("2026-07"); expect(headerToYm("202607")).toBe("2026-07");
  expect(headerToYm("2022년 3월")).toBe("2022-03"); expect(headerToYm("22년 3월")).toBe("2022-03"); expect(headerToYm("Description")).toBeNull(); expect(headerToYm("13-2026")).toBeNull();
});
it("detects wide layout like 부품_Part_Tool_3년사용량.csv", () => {
  const headers = ["Item", "HOC", "Description", "Family", "03-2022", "02-2022", "01-2022", "12-2021", "11-2021", "10-2021"];
  const w = detectWide(headers)!;
  expect(w.itemCol).toBe("Item"); expect(w.monthCols.map(m => m.ym)).toEqual(["2021-10", "2021-11", "2021-12", "2022-01", "2022-02", "2022-03"]); expect(w.otherCols).toContain("Description");
  expect(detectWide(["품목코드", "월", "수량"])).toBeNull();
});
it("converts to long rows, skipping blanks/zeros and reporting non-numbers", () => {
  const w = detectWide(["Item", "01-2022", "02-2022", "03-2022", "04-2022", "05-2022", "06-2022"])!;
  const r = wideToLong([{ Item: "A1", "01-2022": "5", "02-2022": "", "03-2022": "0", "04-2022": "1,200", "05-2022": "x", "06-2022": "2" }, { Item: "", "01-2022": "1" }], w, "PART");
  expect(r.rows).toEqual([{ item_code: "A1", ym: "2022-01", qty: 5, item_type: "PART" }, { item_code: "A1", ym: "2022-04", qty: 1200, item_type: "PART" }, { item_code: "A1", ym: "2022-06", qty: 2, item_type: "PART" }]);
  expect(r.errors).toEqual([{ row: 1, message: "05-2022 숫자 아님: x" }, { row: 2, message: "품목코드 없음" }]);
});
