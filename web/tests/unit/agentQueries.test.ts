import { describe, it, expect } from "vitest";
import { agentRates, evidenceLine, type AgentEvent } from "@/lib/queries/agent";
describe("agent queries (D-042)", () => {
  it("채택률·유용률", () => {
    expect(agentRates({ open: 1, proposed: 1, accepted: 3, dismissed: 1, resolved: 0, useful: 2, not_useful: 2, severe: 0, by_signal: [] })).toEqual({ adoption: 0.75, useful: 0.5 });
    expect(agentRates({ open: 0, proposed: 0, accepted: 0, dismissed: 0, resolved: 0, useful: 0, not_useful: 0, severe: 0, by_signal: [] })).toEqual({ adoption: null, useful: null });
  });
  it("근거 한 줄", () => {
    const e = { signal: "stockout", evidence: { need_ym: "2026-10", start_need: 5, forecast_need: 20, extras: 0, final_qty: 10, end_after: -5, shortage: 5, moq: 5 } } as unknown as AgentEvent;
    expect(evidenceLine(e)).toBe("필요월 2026-10 · 기초 5 − 수요 20+0 · 발주 10 → 기말 -5 · 부족 5 (MOQ 5)");
  });
});
