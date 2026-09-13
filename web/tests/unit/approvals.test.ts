import { it, expect } from "vitest";
import { describeApproval, validateDecision } from "@/lib/queries/approvals";
it("describes item_setting payload", () => {
  const s = describeApproval({ kind: "item_setting", target_pk: "556K59129", payload: { target_dos_days: 45, moq: 10 } }, { target_dos_days: 30, moq: 1 });
  expect(s).toBe("품목 556K59129: 목표 DoS 30 → 45, MOQ 1 → 10");
});
it("requires comment on reject", () => {
  expect(validateDecision("rejected", "")).toEqual({ ok: false, error: "반려 사유를 입력하세요" });
  expect(validateDecision("approved", "").ok).toBe(true);
});
