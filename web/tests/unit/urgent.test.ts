import { it, expect } from "vitest";
import { URGENT_STAGES, STAGE_LABEL, stageIndex, progressPct, urgentSteps } from "@/lib/queries/urgent";
it("단계 순서는 요청→승인→접수→출하→출항→입항→통관→입고 (R-SCH-33)", () => {
  expect(URGENT_STAGES).toEqual(["requested", "approved", "po_accepted", "shipped", "departed", "arrived", "customs", "received"]);
  expect(URGENT_STAGES.every(s => STAGE_LABEL[s])).toBe(true);
});
it("진행률: 요청 0% → 입고 100%, 반려·미지 단계는 0", () => {
  expect(progressPct("requested")).toBe(0); expect(progressPct("received")).toBe(100); expect(progressPct("departed")).toBe(Math.round(4 / 7 * 100));
  expect(stageIndex("rejected")).toBe(-1); expect(progressPct("rejected")).toBe(0); expect(progressPct("???")).toBe(0);
});
it("스텝 표시: 지난 단계 done, 현재 current, 이후 todo", () => {
  const st = urgentSteps("shipped");
  expect(st.map(s => s.state)).toEqual(["done", "done", "done", "current", "todo", "todo", "todo", "todo"]);
  expect(urgentSteps("rejected").every(s => s.state === "todo")).toBe(true);
});
