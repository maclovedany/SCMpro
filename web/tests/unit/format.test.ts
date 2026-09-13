import { it, expect } from "vitest";
import { fmtInt, fmtPct, fmtYm } from "@/lib/format";
it("formats", () => {
  expect(fmtInt(1234567)).toBe("1,234,567");
  expect(fmtInt(null)).toBe("-");
  expect(fmtPct(0.4023)).toBe("40.2%");
  expect(fmtYm("2026-07")).toBe("26-07");
});
