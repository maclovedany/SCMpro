import { it, expect } from "vitest";
import { validateItemSettingPayload } from "@/lib/queries/admin";
it("rejects bad values", () => {
  expect(validateItemSettingPayload({ target_dos_days: 0 }, "이유")).toEqual({ ok: false, error: "목표 DoS 는 1~365 일이어야 합니다" });
  expect(validateItemSettingPayload({ moq: 1.5 }, "이유").ok).toBe(false);
  expect(validateItemSettingPayload({ moq: 10 }, "").ok).toBe(false);
});
it("accepts valid", () => {
  expect(validateItemSettingPayload({ target_dos_days: 45, moq: 10, unit_price: 1000, allocation_mode: "manual" }, "기종 특성상 45일").ok).toBe(true);
});
