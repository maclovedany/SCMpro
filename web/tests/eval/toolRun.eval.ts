/** 도구 실행 점검: 역할마다 그 역할의 도구를 전부 실제 DB 에 실행해 본다 — 오류 없이 8초(API 제한) 안에 끝나는지 */
import { it, expect, describe } from "vitest";
import { toolsForRole, runTool } from "@/lib/ai/tools";
import { ROLES, signIn } from "./env";
const ARGS: Record<string, Record<string, unknown>[]> = {
  search_items: [{ q: "toner" }], get_item: [{ code: "556K59129" }], get_item_forecast: [{ code: "556K59129" }], get_available_stock: [{ code: "556K59129" }], get_order_plan: [{ code: "556K59129" }],
  get_help: [{ q: "강제 배정 한도" }, { q: "Flex" }], list_stock_risks: [{}, { kind: "low_dos", abc: "A" }, { kind: "zero_stock", category: "CONSUMABLE" }, { kind: "excess", top: 5 }],
  get_item_projection: [{ code: "556K59129" }], list_inbound: [{}, { code: "556K59129" }], get_approvals: [{}, { status: "approved", kind: "order_plan", top: 3 }],
  list_agent_events: [{}, { signal: "inbound_delay", min_severity: 2 }], get_customer_allocation: [{}, { customer: "대학" }], list_sales_orders: [{}, { mine: true }, { expiring_days: 30 }, { status: "waiting" }],
  get_submission_status: [{}, { ym: "2026-10" }], get_force_alloc: [{}], list_extra_demand: [{}, { kind: "urgent" }], get_group_stock: [{}, { all: true }], list_urgent_orders: [{}, { mine: true }, { delayed: true }],
  get_settings: [{}, { q: "flex" }], get_ai_usage: [{ days: 7 }], search_mc_families: [{ biz: "DT", top: 5 }, { q: "1" }], get_mc_totals: [{}, { fy: 2025, biz: "PRT" }],     // get_mc_family 는 아래에서 찾은 이름으로 (이름을 저장소에 쓰지 않는다)
};
describe.each(ROLES)("도구 실행 — %s", role => {
  it("이 역할의 모든 도구가 오류 없이 8초 안에 답한다", async () => {
    const { sb, ctx } = await signIn(role); const bad: string[] = []; const log: string[] = [];
    const fam = ((await runTool(sb, "search_mc_families", { top: 1 }, ctx)) as { family: string }[])[0]?.family;
    for (const t of toolsForRole(role)) for (const a of t.name === "get_mc_family" ? [{ family: fam }] : ARGS[t.name] ?? [{}]) {
      const t0 = Date.now(); const out = await runTool(sb, t.name, a, ctx) as Record<string, unknown> | unknown[] | null; const ms = Date.now() - t0;
      const err = out && !Array.isArray(out) && typeof out.error === "string" ? out.error : null; const size = JSON.stringify(out ?? null).length;
      log.push(`${t.name}${JSON.stringify(a)} ${ms}ms ${size}B${err ? " ERROR " + err : ""}`);
      if (err || ms > 8000 || size > 20000 || out == null) bad.push(`${t.name}${JSON.stringify(a)}: ${err ?? (ms > 8000 ? `${ms}ms` : size > 20000 ? `${size}B (20,000자 넘음 — 잘림)` : "null")}`);
    }
    console.log(`[${role}] ${toolsForRole(role).length} tools\n  ` + log.join("\n  "));
    expect(bad).toEqual([]);
  });
});
