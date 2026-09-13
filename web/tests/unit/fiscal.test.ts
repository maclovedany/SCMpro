import { it, expect } from "vitest";
import { fyOf, fyLabel, fyRange, fyMonths } from "@/lib/fiscal";
it("FY starts in April (D-015)", () => {
  expect(fyOf("2025-04")).toBe(2025);
  expect(fyOf("2026-03")).toBe(2025);
  expect(fyOf("2026-04")).toBe(2026);
  expect(fyLabel("2026-03")).toBe("FY25");
  expect(fyRange(2025)).toEqual({ from: "2025-04", to: "2026-03" });
  expect(fyMonths(2025)).toHaveLength(12);
  expect(fyMonths(2025)[0]).toBe("2025-04");
  expect(fyMonths(2025)[11]).toBe("2026-03");
});
it("honors custom start month", () => {
  expect(fyOf("2025-01", 1)).toBe(2025);
  expect(fyOf("2025-03", 4)).toBe(2024);
});
