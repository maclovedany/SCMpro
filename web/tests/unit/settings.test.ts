import { it, expect } from "vitest";
import { encodeSetting, describeSetting, SETTINGS, SETTING_ORDER } from "@/lib/settings/registry";
it("encodes and validates by type", () => {
  expect(encodeSetting("dos_avg_months", "6")).toEqual({ ok: true, json: "6" });
  expect(encodeSetting("dos_avg_months", "0").ok).toBe(false);
  expect(encodeSetting("fiscal_year_start_month", "4")).toEqual({ ok: true, json: "4" });
  expect(encodeSetting("expiry_reminder_days", "1, 3,10, 5")).toEqual({ ok: true, json: "[10,5,3,1]" });
  expect(encodeSetting("flex_ranges", [{ offset: 2, pct: 30 }, { offset: 1, pct: 20 }])).toEqual({ ok: true, json: '[{"offset":1,"pct":20},{"offset":2,"pct":30}]' });
  expect(encodeSetting("flex_ranges", [{ offset: 1, pct: 20 }, { offset: 1, pct: 30 }]).ok).toBe(false);
  expect(encodeSetting("submission_depts", []).ok).toBe(false);
  expect(encodeSetting("submit_deadline_rule", "last_day-1")).toEqual({ ok: true, json: '"last_day-1"' });
});
it("describes values for non-developers", () => {
  expect(describeSetting("flex_ranges", [{ offset: 1, pct: 20 }, { offset: 2, pct: 30 }])).toBe("1번째 달 ±20%, 2번째 달 ±30% · 이후 제한 없음");
  expect(describeSetting("submission_depts", ["sales", "service"])).toBe("영업부, 서비스부");
  expect(describeSetting("submit_deadline_rule", "last_day-1")).toBe("전월 말일의 하루 전");
  expect(SETTING_ORDER.every(k => k in SETTINGS)).toBe(true);
});
