import { it, expect, describe } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TOOLS, toolsForRole, toolSpecs, runTool } from "@/lib/ai/tools";
import { buildTasks, dashboardBrief, planDiff, deptOf, pickSettings, todayKst } from "@/lib/ai/roleTools";
import { systemPrompt } from "@/lib/ai/chat";
import type { ToolCtx } from "@/lib/ai/toolTypes";
import type { Role } from "@/lib/auth/roles";
import type { DashboardV2 } from "@/lib/queries/dashboard";
import type { DashboardExt } from "@/lib/queries/dashboardExt";
const ctx = (role: Role, p: Partial<ToolCtx> = {}): ToolCtx => ({ role, userId: "u1", dept: null, name: "홍길동", ...p });
const names = (r: Role) => toolsForRole(r).map(t => t.name);
describe("역할별 도구 (R-AI-09, D-081)", () => {
  it("30 tools with unique names", () => { expect(TOOLS.length).toBe(30); expect(new Set(TOOLS.map(t => t.name)).size).toBe(30); });
  it("every role gets the common tools", () => {
    for (const r of ["item_manager", "scm_lead", "sales", "marketing", "service", "biz_enable", "admin"] as Role[])
      for (const n of ["get_help", "get_my_tasks", "get_dashboard", "search_items", "get_item", "list_stock_risks", "list_inbound", "list_sales_orders", "get_submission_status", "list_urgent_orders", "search_mc_families", "get_mc_family", "get_mc_totals"]) expect(names(r)).toContain(n);
  });
  it("role-specific tools go only to the roles that use them", () => {
    for (const n of ["get_settings", "get_forecast_runs", "get_approvals", "compare_order_plans", "list_agent_events", "get_data_readiness", "get_ai_usage", "get_force_alloc"]) { expect(names("sales")).not.toContain(n); expect(names("marketing")).not.toContain(n); }
    expect(names("sales")).toContain("get_customer_allocation"); expect(names("marketing")).not.toContain("get_customer_allocation");
    expect(names("marketing")).toContain("get_group_stock"); expect(names("service")).toContain("get_group_stock"); expect(names("sales")).not.toContain("get_group_stock");
    expect(names("biz_enable")).toContain("get_force_alloc"); expect(names("item_manager")).not.toContain("get_force_alloc");
    expect(names("item_manager")).toContain("get_approvals"); expect(names("scm_lead")).toContain("compare_order_plans");
    expect(names("scm_lead")).not.toContain("get_ai_usage"); expect(names("admin").length).toBe(30);
  });
  it("non-SCM roles get fewer tools", () => {
    for (const r of ["sales", "marketing", "service", "biz_enable"] as Role[]) expect(names(r).length).toBeLessThanOrEqual(24);
    expect(toolSpecs("sales").length).toBe(names("sales").length);
    expect(toolSpecs("sales").every(s => s.type === "function" && (s.function.parameters as { type: string }).type === "object")).toBe(true);
  });
  it("a tool outside the role is refused without running", async () => {
    const r = await runTool({} as never, "get_settings", {}, ctx("sales")) as { error: string };
    expect(r.error).toContain("권한"); expect((await runTool({} as never, "no_such_tool", {}, ctx("admin")) as { error: string }).error).toContain("unknown");
  });
  it("tools are read-only: no writes in the tool code", () => {
    for (const f of ["lib/ai/tools.ts", "lib/ai/roleTools.ts", "lib/ai/mcTools.ts", "lib/ai/help.ts"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "../..", f), "utf8");
      expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
      for (const m of src.matchAll(/\.rpc\("([a-z_0-9]+)"/g)) expect(["fn_dashboard_v2", "fn_dashboard_ext", "fn_submission_status", "fn_plan_scorecard", "fn_agent_stats", "fn_ai_stats", "fn_order_calendar", "fn_plan_model_summary"]).toContain(m[1]);
    }
  });
  it("system prompt names the role and tells the agent not to change data", () => {
    const p = systemPrompt(ctx("sales"));
    expect(p).toContain("영업부"); expect(p).toContain("조회만"); expect(p).toContain("get_help");
  });
  it("system prompt lists what this role cannot see, so the agent says so instead of guessing", () => {
    const p = systemPrompt(ctx("sales"));
    for (const k of ["AI 감시 경보", "시스템 설정값", "승인(결재) 건"]) expect(p).toContain(k);
    expect(p).not.toContain("고객사 배정 현황,");                                                     // 영업부는 볼 수 있는 자료
    expect(systemPrompt(ctx("admin"))).not.toContain("볼 수 없는 자료");
    expect(TOOLS.every(t => t.label && t.label.length >= 2)).toBe(true);
  });
});
const dash = { stock: { expected_end_amount: 1, target_amount: 1, current_amount: 1 }, dos: [{ category: "PART", avg_dos: 20, avg_target: 30, n: 1 }], excess: { n: 0, amount: 0 },
  risk: { stockout: 12, stockout_a: 3, out_of_stock_with_orders: 0, inbound_delayed: { n: 2, qty: 5 } },
  cycle: { plan: { id: "p1", plan_ym: "2026-09", status: "draft", amount: 10, created_at: "" }, prev_amount: null, ol_base_amount: 0, next_order: { date: "2026-10-05", supplier: "S", eta: "", days: 5 },
    submission: { ym: "2026-10", deadline: "2026-09-29", overdue: true, depts: [{ dept: "sales", submitted: false }, { dept: "marketing", submitted: true }] } },
  forecast: { backtest: null, production: null, pending_proposals: 2 }, ops: { approvals: [], approvals_total: 0, oldest_pending_hours: null, expiring_7d: 0, waiting: { n: 0, shortage: 0 } },
  data: { items_by_category: { PART: 1 }, dummy_items: 9, dummy_stock: 0, missing_target_dos: 0, snapshot_date: null, last_upload: null }, charts: {} } as unknown as DashboardV2;
const ext = { inventory: { snapshot_date: "2026-09-17", n_items: 5, zero_stock: 1, zero_available: 0, low_dos: 2, by_cat: [{ category: "SUPPLY", on_hand: 1, allocated: 0, available: 1, n_items: 1 }] }, groups: [],
  urgent: { open: 3, delayed: 1, pending_approval: 0, received_30d: 0, mine_open: 2, stages: [], recent: [] }, customer: { customers: 4, need: 10, allocated: 6, shortage: 4, short_customers: 2, top: [] } } as unknown as DashboardExt;
describe("내 할 일 · 대시보드 요약 · 계획 비교", () => {
  const orders = [{ order_no: "SO-1", expires_at: "2026-10-03T00:00:00Z", shortage: 0, status: "review_requested" }, { order_no: "SO-2", expires_at: "2026-11-30T00:00:00Z", shortage: 7, status: "waiting" }];
  it("sales: submission due, expiring allocation, short order, my urgent orders", () => {
    const t = buildTasks({ dash, ext, unread: 4, myOrders: orders, approvals: [{ kind: "bulkdeal", requested_by: "u1" }] }, ctx("sales"), "2026-09-30").map(x => x.what);
    expect(t).toEqual(["내가 올린 승인 요청 (결재 대기)", "2026-10 수요자료 제출", "임시배정 만료 임박 (7일 안) — 수주 확정 필요", "배정이 부족한 내 주문", "내가 요청한 긴급발주 진행 중", "읽지 않은 알림"]);
  });
  it("item manager: confirm the draft plan, review risks; lead: approvals to decide", () => {
    const im = buildTasks({ dash, ext, unread: 0, myOrders: [], approvals: [] }, ctx("item_manager"), "2026-09-30");
    expect(im.map(x => x.what)).toEqual(["발주 계획 2026-09 확정 → 팀장 승인 요청", "다음 발주일", "2026-10 수요자료 미제출 부서", "내가 요청한 긴급발주 진행 중", "지연된 긴급발주", "품절 위험 품목 검토", "AI 예측 조정 제안 검토"]);
    expect(im[0].where).toBe("/orders/p1"); expect(im[2].detail).toContain("영업부");
    const lead = buildTasks({ dash, ext, unread: 0, myOrders: [], approvals: [{ kind: "order_plan", requested_by: "u9" }, { kind: "bulkdeal", requested_by: "u9" }] }, ctx("scm_lead"), "2026-09-30");
    expect(lead[0]).toMatchObject({ what: "승인 대기 결재", n: 2, where: "/approvals" }); expect(lead.map(x => x.what)).not.toContain("발주 계획 2026-09 확정 → 팀장 승인 요청");
  });
  it("dashboard brief hides data readiness and customer allocation by role, shows company category names", () => {
    const s = dashboardBrief(dash, ext, "marketing") as Record<string, unknown>;
    expect(s.data_readiness).toBeUndefined(); expect(s.customer_allocation).toBeUndefined();
    expect((s.dos_by_category as { category: string }[])[0].category).toBe("SPAREPARTS"); expect((s.inventory as { by_category: { category: string }[] }).by_category[0].category).toBe("CONSUMABLE");
    const a = dashboardBrief(dash, ext, "item_manager") as Record<string, unknown>; expect(a.data_readiness).toBeDefined(); expect(a.customer_allocation).toBeDefined();
    expect(dashboardBrief(null, null, "admin")).toEqual({ error: "대시보드 자료 없음" });
  });
  it("plan diff = after − before", () => {
    const d = planDiff({ plan_ym: "2026-09", status: "approved", amount: 120, n_lines: 10, summary: { qty: 50, stockout: 3, flex_hit: 2 } }, { plan_ym: "2026-09", status: "approved", amount: 100, n_lines: 10, summary: { qty: 40, stockout: 5, flex_hit: 2 } })!;
    expect(d[0]).toEqual({ item: "금액", before: 100, after: 120, change: 20, change_pct: 0.2 }); expect(d.find(x => x.item === "품절 위험")!.change).toBe(-2);
    expect(planDiff(null, null)).toBeNull();
  });
  it("department for submissions comes from the role", () => { expect(deptOf("sales")).toBe("sales"); expect(deptOf("item_manager")).toBeNull(); });
});
describe("설정 찾기 · 오늘 날짜", () => {
  const rows = [{ key: "auto_run_enabled", name: "예측 자동 실행", value: "켬", help: "매월 자동으로 예측을 돌린다" }, { key: "agent_mode", name: "AI 감시 자율 모드", value: "dryrun", help: "" }, { key: "flex_ranges", name: "Flex 허용 범위", value: "±20%", help: "" }];
  it("matches any word of the question; with no match returns everything", () => {
    expect(pickSettings(rows, "예측 자동 실행 켜져 있어? AI 감시 모드는?").map(r => r.key)).toEqual(["auto_run_enabled", "agent_mode"]);
    expect(pickSettings(rows, "flex").map(r => r.key)).toEqual(["flex_ranges"]);
    expect(pickSettings(rows, "전혀없는말").length).toBe(3); expect(pickSettings(rows, "").length).toBe(3);
  });
  it("today is the date in Korea", () => { expect(todayKst(new Date("2026-09-29T23:50:00Z"))).toBe("2026-09-30"); expect(todayKst(new Date("2026-09-29T14:59:00Z"))).toBe("2026-09-29"); });
});
