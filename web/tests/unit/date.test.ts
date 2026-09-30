import { it, expect } from "vitest";
import { todayKst, thisYmKst, nextYmKst, yearKst, daysBackKst } from "@/lib/date";
import { nextYm, thisYm } from "@/lib/queries/schedule";
// 업무 날짜는 한국 시간 (D-082). 서버(UTC)·브라우저의 시간대와 무관하게 같은 값이 나와야 한다
const beforeNine = new Date("2026-09-30T23:50:00Z");      // 한국 10-01 08:50
const afterNine = new Date("2026-10-01T00:10:00Z");       // 한국 10-01 09:10
it("date, month and year follow Korea time", () => {
  expect(todayKst(beforeNine)).toBe("2026-10-01"); expect(todayKst(afterNine)).toBe("2026-10-01"); expect(todayKst(new Date("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
  expect(thisYmKst(beforeNine)).toBe("2026-10"); expect(nextYmKst(beforeNine)).toBe("2026-11");
  expect(nextYmKst(new Date("2026-12-31T15:00:00Z"))).toBe("2027-02");                    // 한국 2027-01-01 00:00 → 다음 달 2027-02
  expect(yearKst(new Date("2026-12-31T15:00:00Z"))).toBe(2027);
});
it("schedule helpers use Korea time", () => { expect(thisYm(beforeNine)).toBe("2026-10"); expect(nextYm(beforeNine)).toBe("2026-11"); });
it("recent days list ends today in Korea", () => {
  const d = daysBackKst(3, beforeNine); expect(d).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
});
import { fmtDateTime } from "@/lib/format";
it("date-time text is shown in Korea time regardless of the server clock", () => {
  const t = fmtDateTime("2026-09-30T23:50:00Z");                 // 한국 10-01 08:50
  expect(t).toContain("10. 1."); expect(t).toContain("8:50");
  expect(fmtDateTime("2026-10-01T08:50:00+09:00")).toBe(t); expect(fmtDateTime(null)).toBe("-");
});
