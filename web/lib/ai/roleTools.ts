/** AI Agent 도구 — 역할별 업무 질문용 20종 (R-AI-09, D-081). 전부 조회 전용이고 사용자 세션으로 읽는다(R-AI-05).
 *  도구마다 roles 가 있어 그 역할의 대화에만 넘긴다 — 역할과 무관한 도구가 섞이면 모델이 엉뚱한 도구를 고른다. */
import { ALL_ROLES, SCM_ROLES, obj, str, num, topN, type ToolDef, type ToolCtx, type SB } from "./toolTypes";
import { searchHelp, searchMenus, menusFor, helpTerms } from "./help";
import { likeValue } from "./mcTools";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { catCode, catLabel } from "@/lib/design/category";
import { describeApproval, kindLabel } from "@/lib/queries/approvals";
import { customerAllocSummary, maxForceQty, type CustAllocRow, type ForcePoolRow } from "@/lib/queries/customers";
import { STAGE_LABEL } from "@/lib/queries/urgent";
import { SO_STATUS } from "@/lib/queries/allocation";
import { SIGNAL_LABEL, STATUS_LABEL } from "@/lib/queries/agent";
import { SETTINGS, describeSetting } from "@/lib/settings/registry";
import type { DashboardV2 } from "@/lib/queries/dashboard";
import type { DashboardExt } from "@/lib/queries/dashboardExt";

const n0 = (v: unknown) => Number(v ?? 0);
/** 오늘 날짜는 한국 시간 기준 — 서버(UTC)의 날짜를 쓰면 오전 9시 전에는 하루 전으로 나온다 */
export const todayKst = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const today = () => todayKst();
const nextYm = (d = new Date()) => { const y = d.getFullYear(), m = d.getMonth() + 2; return `${y + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}`; };
/** 수요자료를 내는 부서 열쇠 (R-SCH): 역할에서 정한다 */
export const deptOf = (role: Role): string | null => (["sales", "marketing", "service", "biz_enable"].includes(role) ? role : null);
const DEPT_KO: Record<string, string> = { marketing: "마케팅부", sales: "영업부", service: "서비스부", biz_enable: "사업강화부" };
const EXTRA_KIND: Record<string, string> = { confirmed_order: "수주 확정", meeting_approval: "수급회의 승인", bulkdeal: "Bulkdeal", urgent: "긴급발주" };
const isScm = (r: Role) => (SCM_ROLES as readonly Role[]).includes(r);
async function latestPlan(sb: SB) {
  return (await sb.schema("analytics").from("v_order_plan_summary").select("id,plan_ym,status,n_lines,amount,summary,created_at,approved_at").order("plan_ym", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
}

// ───────────────────────── 순수 함수 (단위 테스트 대상)
export type Task = { what: string; n?: number; detail?: string; where: string };
/** 역할별 "지금 할 일" — 대시보드 집계와 내 주문·승인에서 뽑는다 */
export function buildTasks(i: { dash: DashboardV2 | null; ext: DashboardExt | null; unread: number; myOrders: { order_no: string | null; expires_at: string | null; shortage: number | null; status: string | null }[];
  approvals: { kind: string | null; requested_by: string | null }[] }, ctx: ToolCtx, now = today()): Task[] {
  const t: Task[] = []; const d = i.dash, x = i.ext; const dept = deptOf(ctx.role);
  const decide = i.approvals.filter(a => a.requested_by !== ctx.userId), mine = i.approvals.filter(a => a.requested_by === ctx.userId);
  if (["scm_lead", "admin"].includes(ctx.role) && decide.length) t.push({ what: "승인 대기 결재", n: decide.length, detail: Object.entries(decide.reduce((m, a) => { const k = kindLabel(a.kind ?? ""); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>)).map(([k, v]) => `${k} ${v}`).join(" · "), where: "/approvals" });
  if (mine.length) t.push({ what: "내가 올린 승인 요청 (결재 대기)", n: mine.length, where: isScm(ctx.role) ? "/approvals" : "/notifications" });
  const plan = d?.cycle.plan;
  if (plan?.status === "draft" && ["item_manager", "admin"].includes(ctx.role)) t.push({ what: `발주 계획 ${plan.plan_ym} 확정 → 팀장 승인 요청`, detail: "초안 상태", where: `/orders/${plan.id}` });
  if (d?.cycle.next_order && isScm(ctx.role)) t.push({ what: "다음 발주일", detail: `${d.cycle.next_order.date} (D-${d.cycle.next_order.days}) · ${d.cycle.next_order.supplier}`, where: "/schedule" });
  const sub = d?.cycle.submission;
  if (sub && dept) { const me = (sub.depts ?? []).find(p => p.dept === dept); if (me && !me.submitted) t.push({ what: `${sub.ym} 수요자료 제출`, detail: `마감 ${sub.deadline}${sub.overdue ? " — 마감 지남" : ""}`, where: "/schedule" }); }
  if (sub && isScm(ctx.role)) { const miss = (sub.depts ?? []).filter(p => !p.submitted); if (miss.length) t.push({ what: `${sub.ym} 수요자료 미제출 부서`, n: miss.length, detail: `${miss.map(p => DEPT_KO[p.dept] ?? p.dept).join(" · ")} · 마감 ${sub.deadline}`, where: "/schedule" }); }
  const week = new Date(now + "T00:00:00Z"); week.setUTCDate(week.getUTCDate() + 7); const lim = week.toISOString().slice(0, 10);
  const exp = i.myOrders.filter(o => o.expires_at && o.expires_at.slice(0, 10) <= lim);
  if (exp.length) t.push({ what: "임시배정 만료 임박 (7일 안) — 수주 확정 필요", n: exp.length, detail: exp.slice(0, 5).map(o => `${o.order_no} (${o.expires_at!.slice(0, 10)})`).join(", "), where: "/sales-orders" });
  const wait = i.myOrders.filter(o => n0(o.shortage) > 0);
  if (wait.length) t.push({ what: "배정이 부족한 내 주문", n: wait.length, detail: `부족 수량 합 ${wait.reduce((a, o) => a + n0(o.shortage), 0)}`, where: "/sales-orders" });
  if (x?.urgent.mine_open) t.push({ what: "내가 요청한 긴급발주 진행 중", n: x.urgent.mine_open, where: "/extra-demand" });
  if (isScm(ctx.role) && x?.urgent.delayed) t.push({ what: "지연된 긴급발주", n: x.urgent.delayed, where: "/extra-demand" });
  if (isScm(ctx.role) && d?.risk.stockout) t.push({ what: "품절 위험 품목 검토", n: d.risk.stockout, detail: `A 등급 ${d.risk.stockout_a}`, where: plan ? `/orders/${plan.id}?risk=true` : "/orders" });
  if (isScm(ctx.role) && d?.forecast.pending_proposals) t.push({ what: "AI 예측 조정 제안 검토", n: d.forecast.pending_proposals, where: "/forecast/runs" });
  if (i.unread) t.push({ what: "읽지 않은 알림", n: i.unread, where: "/notifications" });
  return t;
}
/** 대시보드 요약 — 차트용 배열과 품목 목록은 빼고 지표만. 데이터 준비 현황은 SCM 역할에만 (R-UI-12) */
export function dashboardBrief(d: DashboardV2 | null, x: DashboardExt | null, role: Role) {
  if (!d) return { error: "대시보드 자료 없음" };
  return { stock: d.stock, dos_by_category: d.dos.map(r => ({ ...r, category: catLabel(r.category) })), excess: d.excess, risk: d.risk,
    order_cycle: { plan: d.cycle.plan, prev_plan_amount: d.cycle.prev_amount, submitted_ol_amount: d.cycle.ol_base_amount, next_order: d.cycle.next_order, submission: d.cycle.submission },
    forecast: d.forecast, operations: d.ops,
    inventory: x ? { snapshot_date: x.inventory.snapshot_date, items_with_stock: x.inventory.n_items, zero_stock_items: x.inventory.zero_stock, zero_available_items: x.inventory.zero_available, below_target_dos_items: x.inventory.low_dos, by_category: x.inventory.by_cat.map(c => ({ ...c, category: catLabel(c.category) })) } : null,
    urgent_orders: x ? { open: x.urgent.open, delayed: x.urgent.delayed, pending_approval: x.urgent.pending_approval, received_30d: x.urgent.received_30d, mine_open: x.urgent.mine_open } : null,
    customer_allocation: x && ["sales", "biz_enable", ...SCM_ROLES].includes(role) ? { customers: x.customer.customers, need: x.customer.need, allocated: x.customer.allocated, shortage: x.customer.shortage, short_customers: x.customer.short_customers } : undefined,
    data_readiness: isScm(role) ? d.data : undefined,
    note: "금액 지표는 단가가 더미라 참고용" };
}
/** 설정 찾기: 질문의 낱말 중 하나라도 이름·도움말에 있으면 고른다. 하나도 없으면 전부 (빈 답을 내지 않는다) */
export function pickSettings<T extends { key: string; name: string; help?: string }>(rows: T[], q: string): T[] {
  const terms = helpTerms(q).filter(k => k.length >= 2 && !["설정", "설정값", "지금", "현재", "얼마", "있어", "뭐야"].includes(k)); if (!terms.length) return rows;
  const sq = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  const hit = rows.filter(r => terms.some(k => sq(r.name).includes(k) || sq(r.key).includes(k) || sq(r.help ?? "").includes(k)));
  return hit.length ? hit : rows;
}
/** 두 계획의 요약 비교 (뒤 − 앞) */
export function planDiff(a: { plan_ym: string | null; status: string | null; amount: unknown; n_lines: unknown; summary: unknown } | null, b: typeof a) {
  if (!a || !b) return null;
  const sa = (a.summary ?? {}) as Record<string, number>, sb_ = (b.summary ?? {}) as Record<string, number>;
  const row = (k: string, x: number, y: number) => ({ item: k, before: y, after: x, change: x - y, change_pct: y ? (x - y) / y : null });
  return [row("금액", n0(a.amount), n0(b.amount)), row("라인 수", n0(a.n_lines), n0(b.n_lines)), row("발주 수량", n0(sa.qty), n0(sb_.qty)), row("품절 위험", n0(sa.stockout), n0(sb_.stockout)),
    row("Flex 도달", n0(sa.flex_hit), n0(sb_.flex_hit)), row("확정 차단", n0(sa.blocked), n0(sb_.blocked)), row("오버라이드", n0(sa.overrides), n0(sb_.overrides))];
}

// ───────────────────────── 도구
export const ROLE_TOOLS: ToolDef[] = [
  // ── 공통
  { name: "get_help", label: "화면 · 용어 도움말", roles: ALL_ROLES, description: "화면 사용법 · 용어 · 메뉴 위치 도움말. '이 용어가 뭐야?', '어디서 해?', '어떻게 요청해?' 같은 질문에 쓰고, 승인·배정·확정·등록·설정 변경을 직접 해 달라는 요청에는 어느 화면에서 하는지 안내할 때 쓴다. 수치를 묻는 질문에는 쓰지 않는다",
    parameters: obj({ q: { type: "string", description: "찾을 말: 화면 이름, 용어, 하려는 일" } }, ["q"]),
    run: async (_sb, a, ctx) => { const q = str(a.q); const help = searchHelp(q); const menus = searchMenus(q, ctx.role);
      return { your_role: ROLE_LABEL[ctx.role], help, menus, ...(menus.length ? {} : { your_menus: menusFor(ctx.role) }), ...(help.length ? {} : { note: "도움말에 없는 내용 — 시스템에서 확인되지 않는다고 답한다" }) }; } },
  { name: "get_my_tasks", label: "내 할 일", roles: ALL_ROLES, description: "내가 지금 처리할 일 요약 (역할에 맞게): 승인 대기, 수요자료 제출 마감, 임시배정 만료 임박, 배정 부족 주문, 긴급발주, 발주 계획 확정, 읽지 않은 알림. '오늘 할 일', '내 마감' 질문에 쓴다", parameters: obj(),
    run: async (sb, _a, ctx) => {
      const [dash, ext, unread, mine, appr] = await Promise.all([sb.schema("app").rpc("fn_dashboard_v2"), sb.schema("app").rpc("fn_dashboard_ext"),
        sb.schema("app").from("notification").select("id", { count: "exact", head: true }).is("read_at", null),
        sb.schema("app").from("v_sales_order").select("order_no,expires_at,shortage,status").eq("sales_rep", ctx.userId).in("status", ["review_requested", "partial", "waiting"]).order("expires_at").limit(50),
        sb.schema("app").from("v_my_approvals").select("kind,requested_by").eq("status", "pending").limit(200)]);
      const tasks = buildTasks({ dash: dash.data as unknown as DashboardV2 | null, ext: ext.data as unknown as DashboardExt | null, unread: unread.count ?? 0, myOrders: mine.data ?? [], approvals: appr.data ?? [] }, ctx);
      return { your_role: ROLE_LABEL[ctx.role], today: today(), tasks, ...(tasks.length ? {} : { note: "지금 처리할 일이 없습니다" }) }; } },
  { name: "get_dashboard", label: "대시보드 지표", roles: ALL_ROLES, description: "대시보드 지표: 재고 금액·DoS·과잉, 품절 위험·입고 지연, 발주 계획 상태와 금액(전월 대비), 예측 정확도, 주문·배정 운영, 재고 현황(재고 0·가용 0), 긴급발주, 고객사 배정 요약. 대시보드 카드의 숫자나 전체 현황을 물을 때 쓴다", parameters: obj(),
    run: async (sb, _a, ctx) => { const [d, x] = await Promise.all([sb.schema("app").rpc("fn_dashboard_v2"), sb.schema("app").rpc("fn_dashboard_ext")]);
      return dashboardBrief(d.data as unknown as DashboardV2 | null, x.data as unknown as DashboardExt | null, ctx.role); } },

  // ── 재고 위험 · 입고
  { name: "list_stock_risks", label: "품절 위험 · 재고 부족 품목", roles: ALL_ROLES, description: "위험 품목 목록: stockout = 최신 발주 계획의 품절 위험(필요월 기초재고 < 수요), low_dos = 목표 DoS 미달, zero_stock = 재고 0, excess = 과잉(DoS 가 목표의 2배 이상). 카테고리·ABC 등급으로 거를 수 있다. 전체 건수와 상위 목록을 준다",
    parameters: obj({ kind: { type: "string", enum: ["stockout", "low_dos", "zero_stock", "excess"], description: "기본 stockout" }, category: { type: "string", description: "SPAREPARTS · CONSUMABLE · OPTION (선택)" }, abc: { type: "string", enum: ["A", "B", "C"] }, top: { type: "integer", description: "기본 10 · 최대 30" } }),
    run: async (sb, a) => { const kind = str(a.kind) || "stockout"; const cat = str(a.category) ? catCode(str(a.category).toUpperCase()) : ""; const abc = str(a.abc).toUpperCase(); const top = topN(a.top);
      if (kind === "stockout") { const p = await latestPlan(sb); if (!p) return { error: "발주 계획 없음" };
        let q = sb.schema("analytics").from("v_plan_line_item").select("key_code,description,category,abc,family,need_ym,start_need,forecast_need,inbound_until_need,final_qty,override_qty,dos_after,amount", { count: "exact" }).eq("plan_id", p.id!).eq("stockout_risk", true);
        if (cat) q = q.eq("category", cat); if (abc) q = q.eq("abc", abc);
        const r = await q.order("amount", { ascending: false, nullsFirst: false }).limit(top);
        return { kind: "품절 위험", plan: { plan_ym: p.plan_ym, status: p.status }, total: r.count ?? 0, order: "금액 큰 순", items: (r.data ?? []).map(x => ({ ...x, category: catLabel(x.category) })) }; }
      const flag = kind === "low_dos" ? "is_below_target" : kind === "zero_stock" ? "is_zero_stock" : "is_excess";
      let q = sb.schema("analytics").from("v_item_risk").select("key_code,description,category,abc,family,on_hand,inbound_qty,avg_6m,total_12m,dos_days,target_dos_days", { count: "exact" }).eq(flag, true);
      if (cat) q = q.eq("category", cat); if (abc) q = q.eq("abc", abc);
      const r = await (kind === "low_dos" ? q.order("dos_days", { ascending: true, nullsFirst: false }) : kind === "excess" ? q.order("dos_days", { ascending: false, nullsFirst: false }) : q.order("total_12m", { ascending: false, nullsFirst: false })).limit(top);
      return { kind: { low_dos: "목표 DoS 미달", zero_stock: "재고 0", excess: "과잉" }[kind] ?? kind, total: r.count ?? 0, order: kind === "low_dos" ? "DoS 짧은 순" : kind === "excess" ? "DoS 긴 순" : "12개월 출고 큰 순", items: (r.data ?? []).map(x => ({ ...x, category: catLabel(x.category) })) }; } },
  { name: "get_item_projection", label: "품목 재고전개", roles: ["item_manager", "scm_lead", "admin", "sales", "biz_enable"], description: "품목의 재고전개(월별): 기초재고 · 입고예정 · 예측 판매 · 추가수요 · 확정 발주 · 기말재고. '언제 재고가 마이너스가 돼?', '12월 기말재고는?' 질문에 쓴다 (최신 발주 계획 기준)",
    parameters: obj({ code: { type: "string", description: "품목 코드" } }, ["code"]),
    run: async (sb, a) => { const p = await latestPlan(sb); if (!p) return { error: "발주 계획 없음" };
      const l = (await sb.schema("app").from("order_plan_line").select("key_code,category,need_ym,on_hand,target_dos_days,final_qty,override_qty,dos_after,stockout_risk,projection").eq("plan_id", p.id!).eq("key_code", str(a.code)).maybeSingle()).data;
      if (!l) return { error: `최신 계획(${p.plan_ym})에 품목 ${str(a.code)} 없음 — SW · 예측 제외 품목은 계획에 없다` };
      const pr = ((l.projection ?? []) as unknown as { ym: string; start: number; inbound: number; forecast: number; extras: number; order: number; end: number }[]);
      return { plan: { plan_ym: p.plan_ym, status: p.status }, item: l.key_code, category: catLabel(l.category), need_ym: l.need_ym, order_qty: l.override_qty ?? l.final_qty, target_dos_days: l.target_dos_days,
        months: pr.map(m => ({ ym: m.ym, start: m.start, inbound: m.inbound, forecast_sales: m.forecast, extra_demand: m.extras, order: m.order, end: m.end })), first_negative_month: pr.find(m => Number(m.end) < 0)?.ym ?? null }; } },
  { name: "list_inbound", label: "입고예정 · 입고 지연", roles: ALL_ROLES, description: "입고예정(Open PO)과 입고 지연: code 를 주면 그 품목의 미입고 PO(계획일·수량·공급처·지연 여부), 없으면 지연(계획일 경과 미입고) 전체 건수·수량과 공급처별 집계, 수량 큰 지연 PO 목록",
    parameters: obj({ code: { type: "string", description: "품목 코드 (선택)" }, supplier: { type: "string", description: "공급처 이름 일부 (선택, 집계에만)" }, top: { type: "integer" } }),
    run: async (sb, a) => { const code = str(a.code), top = topN(a.top), t = today();
      if (code) { const r = (await sb.schema("app").from("inbound").select("po_no,qty,planned_date,status,is_dummy,supplier:supplier_id(name)").eq("item_code", code).neq("status", "received").order("planned_date").limit(50)).data ?? [];
        return { item: code, open_po: r.length, qty: r.reduce((s, x) => s + n0(x.qty), 0), rows: r.map(x => ({ po_no: x.po_no, qty: x.qty, planned_date: x.planned_date, status: x.status, supplier: (x.supplier as { name?: string } | null)?.name ?? null, delayed: x.planned_date < t, is_dummy: x.is_dummy })) }; }
      let s = sb.schema("analytics").from("v_inbound_delay").select("*"); if (str(a.supplier)) s = s.ilike("supplier", `%${str(a.supplier)}%`);
      const [by, rows] = await Promise.all([s.order("n", { ascending: false }), sb.schema("app").from("inbound").select("item_code,po_no,qty,planned_date,supplier:supplier_id(name)").neq("status", "received").lt("planned_date", t).order("qty", { ascending: false }).limit(top)]);
      const b = by.data ?? [];
      return { as_of: t, delayed: { n: b.reduce((x, r) => x + n0(r.n), 0), qty: b.reduce((x, r) => x + n0(r.qty), 0) }, by_supplier: b, largest: (rows.data ?? []).map(x => ({ item_code: x.item_code, po_no: x.po_no, qty: x.qty, planned_date: x.planned_date, supplier: (x.supplier as { name?: string } | null)?.name ?? null })),
        note: "지연 = 계획일(Need By)이 지났는데 아직 입고되지 않은 PO. 재고전개에서는 첫 달 입고로 계산한다" }; } },

  // ── SCM
  { name: "get_data_readiness", label: "데이터 준비 상태", roles: SCM_ROLES, description: "데이터 준비 상태: 더미 설정·더미 재고가 남은 품목 수, 목표 DoS 미설정 품목, 재고 스냅샷 기준일, 마지막 업로드(파일·성공·오류 건수), 카테고리별 품목 수", parameters: obj(),
    run: async sb => { const d = (await sb.schema("app").rpc("fn_dashboard_v2")).data as unknown as DashboardV2 | null; if (!d) return { error: "자료 없음" };
      return { ...d.data, items_by_category: Object.fromEntries(Object.entries(d.data.items_by_category ?? {}).map(([k, v]) => [catLabel(k), v])), where: "/upload · /admin/item-settings" }; } },
  { name: "get_forecast_runs", label: "예측 실행 · AI 조정 제안", roles: SCM_ROLES, description: "예측 실행 이력과 AI 오차 분석·조정 제안: 최근 백테스트·프로덕션 실행(상태·학습 구간·정확도 요약), 조정 제안(상태·모델·진단·제안 내용)", parameters: obj({ top: { type: "integer", description: "기본 5" } }),
    run: async (sb, a) => { const top = topN(a.top, 5, 10);
      const [runs, props] = await Promise.all([sb.schema("app").from("forecast_run").select("id,run_type,eval_fy,train_from,train_to,horizon,status,summary,error,created_at,finished_at").order("created_at", { ascending: false }).limit(top),
        sb.schema("app").from("forecast_tuning_proposal").select("id,run_id,model,status,created_at,response").order("created_at", { ascending: false }).limit(top)]);
      return { runs: (runs.data ?? []).map(r => ({ ...r, run_type: r.run_type === "backtest" ? "백테스트" : "프로덕션 예측" })),
        proposals: (props.data ?? []).map(p => { const r = (p.response ?? {}) as { diagnosis?: { area: string; finding: string }[]; proposals?: { method_key: string; scope?: string; param_patch?: unknown; rationale?: string }[] };
          return { id: p.id, run_id: p.run_id, model: p.model, status: p.status, created_at: p.created_at, diagnosis: (r.diagnosis ?? []).slice(0, 6).map(x => `${x.area}: ${x.finding}`), proposals: (r.proposals ?? []).map(x => ({ method: x.method_key, scope: x.scope, change: x.param_patch, why: x.rationale })) }; }),
        where: "/forecast/runs", note: "제안은 팀장 승인 전에는 예측에 반영되지 않는다" }; } },
  { name: "get_approvals", label: "승인(결재) 건", roles: SCM_ROLES, description: "승인(결재) 건 목록과 상세: 종류(발주 계획·품목 설정·Bulkdeal·우선 배정·긴급발주·AI 제안)·요청자·사유·내용. 발주 계획 건은 계획 요약과 오버라이드한 품목·사유를 함께 준다. status 기본 pending",
    parameters: obj({ status: { type: "string", enum: ["pending", "approved", "rejected"] }, kind: { type: "string", description: "order_plan · item_setting · bulkdeal · priority_alloc · urgent_order · forecast_tuning · agent_order (선택)" }, top: { type: "integer" } }),
    run: async (sb, a) => { const st = ["pending", "approved", "rejected"].includes(str(a.status)) ? str(a.status) : "pending";
      let q = sb.schema("app").from("v_my_approvals").select("id,kind,target_pk,payload,reason,comment,status,requested_at,decided_at,requester_name,approver_name").eq("status", st as "pending"); if (str(a.kind)) q = q.eq("kind", str(a.kind) as "order_plan");
      const rows = (await q.order("requested_at", { ascending: false }).limit(topN(a.top, 10, 20))).data ?? [];
      const out = [];
      for (const r of rows) { const base = { id: r.id, kind: kindLabel(r.kind ?? ""), what: describeApproval({ kind: r.kind!, target_pk: r.target_pk!, payload: r.payload as Record<string, unknown> }), reason: r.reason, requester: r.requester_name, requested_at: r.requested_at, status: r.status, comment: r.comment, approver: r.approver_name, decided_at: r.decided_at };
        if (r.kind === "order_plan" && out.filter(o => "overrides" in o).length < 2) { const ov = (await sb.schema("analytics").from("v_plan_line_item").select("key_code,description,category,need_ym,final_qty,override_qty,override_reason,amount").eq("plan_id", r.target_pk!).not("override_qty", "is", null).order("amount", { ascending: false }).limit(20)).data ?? [];
          out.push({ ...base, overrides: ov.map(o => ({ ...o, category: catLabel(o.category) })) }); } else out.push(base); }
      return { status: st, n: out.length, approvals: out, where: "/approvals", note: "승인·반려는 승인함 화면에서 팀장이 한다" }; } },
  { name: "compare_order_plans", label: "발주 계획 비교 · 채점", roles: SCM_ROLES, description: "발주 계획 비교와 채점: 최신 계획과 그 앞 계획의 금액·라인·수량·품절 위험·Flex 도달 차이, 오버라이드한 품목과 사유, 지난 계획 채점(실제 발주 vs 시스템 제안대로였다면 — 결품·과잉·적정)", parameters: obj(),
    run: async sb => { const plans = (await sb.schema("analytics").from("v_order_plan_summary").select("id,plan_ym,status,n_lines,amount,summary,created_at,approved_at").order("created_at", { ascending: false }).limit(12)).data ?? [];
      const cur = plans[0]; if (!cur) return { error: "발주 계획 없음" }; const prev = plans[1] ?? null; const prevMonth = plans.find(p => p.status === "approved" && (p.plan_ym ?? "") < (cur.plan_ym ?? "")) ?? null;
      const [ov, sc] = await Promise.all([sb.schema("analytics").from("v_plan_line_item").select("key_code,description,category,need_ym,final_qty,override_qty,override_reason").eq("plan_id", cur.id!).not("override_qty", "is", null).limit(20), sb.schema("app").rpc("fn_plan_scorecard", { p_plan_id: cur.id! })]);
      const s = (sc.data ?? {}) as { scored?: number; last_ym?: string; human?: unknown; system?: unknown; overrides?: unknown };
      const brief = (p: typeof cur | null) => p && { plan_ym: p.plan_ym, status: p.status, created_at: p.created_at, approved_at: p.approved_at, amount: p.amount, lines: p.n_lines, summary: p.summary };
      return { latest: brief(cur), previous: brief(prev), vs_previous: planDiff(cur, prev), previous_month_approved: brief(prevMonth), vs_previous_month: planDiff(cur, prevMonth),
        overrides: (ov.data ?? []).map(o => ({ ...o, category: catLabel(o.category) })), scorecard: s.scored ? s : { scored: 0, note: "필요월 실적이 아직 없어 채점 전" }, where: `/orders/${cur.id}` }; } },
  { name: "list_agent_events", label: "AI 감시 경보", roles: SCM_ROLES, description: "AI 감시 경보: 지금 열려 있는 신호(품절 위험·재고 부족·입고 지연·발주일 임박·수요 급증)와 심각도(1~3)·판단 사유, 신호별 건수, 최근 30일 채택률",
    parameters: obj({ signal: { type: "string", enum: ["stockout", "low_dos", "inbound_delay", "lead_imminent", "demand_surge"] }, min_severity: { type: "integer", description: "1~3" }, top: { type: "integer" } }),
    run: async (sb, a) => { let q = sb.schema("app").from("agent_event").select("signal,item_code,category,supplier,severity,status,first_seen,last_seen,judgment", { count: "exact" }).in("status", ["open", "notified", "proposed"]);
      if (str(a.signal)) q = q.eq("signal", str(a.signal)); if (num(a.min_severity)) q = q.gte("severity", num(a.min_severity)!);
      const [r, st] = await Promise.all([q.order("severity", { ascending: false, nullsFirst: false }).order("last_seen", { ascending: false }).limit(topN(a.top)), sb.schema("app").rpc("fn_agent_stats", { p_days: 30 })]);
      return { active: r.count ?? 0, events: (r.data ?? []).map(e => { const j = (e.judgment ?? {}) as { action?: string; qty?: number; need_ym?: string; reason?: string; by?: string };
        return { signal: SIGNAL_LABEL[e.signal] ?? e.signal, item_code: e.item_code, category: catLabel(e.category), supplier: e.supplier, severity: e.severity, status: STATUS_LABEL[e.status] ?? e.status, first_seen: e.first_seen, judged_action: j.action, suggested_qty: j.qty, need_ym: j.need_ym, reason: j.reason, judged_by: j.by === "llm" ? "AI" : "규칙" }; }),
        stats_30d: st.data, where: "/agent" }; } },
  { name: "get_settings", label: "시스템 설정값", roles: SCM_ROLES, description: "시스템 설정값 조회: 목표 DoS 기본값, Flex 범위, OL 제출 선행 개월, 리드타임, 임시배정 일수, 제출 마감 규칙, 자동 실행, AI 감시 모드, AI 모델 등. q 로 이름 일부를 주면 그것만",
    parameters: obj({ q: { type: "string", description: "설정 이름 일부 (선택)" } }),
    run: async (sb, a) => { const rows = (await sb.schema("app").from("system_settings").select("key,value,description,updated_at").order("key")).data ?? [];
      const out = pickSettings(rows.map(r => ({ key: r.key, name: SETTINGS[r.key]?.label ?? r.description ?? r.key, value: describeSetting(r.key, r.value), help: SETTINGS[r.key]?.help, updated_at: r.updated_at })), str(a.q));
      return { n: out.length, settings: out, where: "/admin/settings", note: "설정 변경은 관리자만, 시스템 설정 화면에서 한다" }; } },
  { name: "get_ai_usage", label: "AI 사용 현황", roles: ["admin"], description: "AI Agent 사용 현황: 기간 내 질문 수·사용자 수·오늘 질문 수·답변 실패 수·주제별 건수·일별 추이·질문 많은 사용자", parameters: obj({ days: { type: "integer", description: "기본 30" } }),
    run: async (sb, a) => ({ days: Math.max(1, Math.min(365, Number(a.days) || 30)), ...(((await sb.schema("app").rpc("fn_ai_stats", { p_days: Math.max(1, Math.min(365, Number(a.days) || 30)) })).data ?? {}) as Record<string, unknown>), where: "/admin/ai-stats" }) },

  // ── 영업 · 사업강화
  { name: "get_customer_allocation", label: "고객사 배정 현황", roles: ["sales", "biz_enable", "item_manager", "scm_lead", "admin"], description: "고객사 배정 현황: 전체 충족률과 부족이 큰 고객사 순위, 또는 customer 를 주면 그 고객사의 품목별 필요·배정·부족. '부족한 고객사', '이 고객사 충족률' 질문에 쓴다",
    parameters: obj({ customer: { type: "string", description: "고객사 이름 또는 코드 일부 (선택)" }, top: { type: "integer" } }),
    run: async (sb, a) => { const k = str(a.customer).toLowerCase(); const data = (await sb.schema("analytics").from("v_customer_allocation").select("*").limit(2000)).data ?? [];
      const rows = data.map(r => ({ ...r, customer_code: r.customer_code ?? "", item_code: r.item_code ?? "", is_strategic: !!r.is_strategic, has_demand_line: !!r.has_demand_line, is_dummy: !!r.is_dummy, need_qty: n0(r.need_qty), order_qty: n0(r.order_qty), n_orders: n0(r.n_orders), temp_qty: n0(r.temp_qty), firm_qty: n0(r.firm_qty), hold_qty: n0(r.hold_qty), forced_qty: n0(r.forced_qty), allocated_qty: n0(r.allocated_qty), shortage_qty: n0(r.shortage_qty), fill_rate: r.fill_rate == null ? null : Number(r.fill_rate), available: n0(r.available) })) as unknown as CustAllocRow[];
      const pick = k ? rows.filter(r => (r.customer_name ?? "").toLowerCase().includes(k) || r.customer_code.toLowerCase().includes(k)) : rows;
      if (k && !pick.length) return { error: `고객사 '${str(a.customer)}' 의 배정 자료 없음` };
      const s = customerAllocSummary(pick);
      return { customers: s.customers, need: s.need, allocated: s.allocated, shortage: s.shortage, fill_rate: s.fillRate, short_customers: s.shortCustomers, by_customer: s.byCustomer.slice(0, topN(a.top)).map(c => ({ customer: c.name, strategic: c.strategic, need: c.need, allocated: c.allocated, shortage: c.shortage, fill_rate: c.fill })),
        short_items: s.topItems, ...(k ? { items: pick.slice(0, 30).map(r => ({ customer: r.customer_name, item_code: r.item_code, description: r.description, need: r.need_qty, allocated: r.allocated_qty, shortage: r.shortage_qty, available: r.available })) } : {}), where: "/sales-orders/customers" }; } },
  { name: "list_sales_orders", label: "영업 주문", roles: ALL_ROLES, description: "영업 주문 조회: 주문번호·고객사·품목·상태로 찾고, 배정(임시·확정)·부족·임시배정 만료일과 부족한 주문의 다음 입고 예정일을 준다. mine=true 면 내가 등록한 주문만, expiring_days 를 주면 그 안에 만료되는 주문만",
    parameters: obj({ order_no: { type: "string" }, customer: { type: "string", description: "고객사 이름 일부" }, item_code: { type: "string" }, status: { type: "string", enum: ["review_requested", "partial", "waiting", "confirmed", "rejected", "cancelled", "expired"] }, mine: { type: "boolean" }, expiring_days: { type: "integer" }, top: { type: "integer" } }),
    run: async (sb, a, ctx) => { let q = sb.schema("app").from("v_sales_order").select("order_no,item_code,description,qty,customer,status,temp_qty,firm_qty,hold_qty,shortage,requested_at,expires_at,confirmed_at,sales_rep_name,is_dummy", { count: "exact" });
      if (str(a.order_no)) q = q.ilike("order_no", `%${str(a.order_no)}%`); if (str(a.customer)) q = q.ilike("customer", `%${str(a.customer)}%`); if (str(a.item_code)) q = q.eq("item_code", str(a.item_code)); if (str(a.status)) q = q.eq("status", str(a.status) as "waiting");
      if (a.mine === true) q = q.eq("sales_rep", ctx.userId);
      if (num(a.expiring_days)) { const d = new Date(); d.setDate(d.getDate() + num(a.expiring_days)!); q = q.in("status", ["review_requested", "partial"]).lte("expires_at", d.toISOString()); }
      const r = await q.order("requested_at", { ascending: false }).limit(topN(a.top)); const rows = r.data ?? [];
      const short = [...new Set(rows.filter(o => n0(o.shortage) > 0).map(o => o.item_code).filter((c): c is string => !!c))];
      const inb = short.length ? (await sb.schema("app").from("inbound").select("item_code,planned_date,qty").in("item_code", short).neq("status", "received").order("planned_date").limit(300)).data ?? [] : [];
      return { total: r.count ?? 0, orders: rows.map(o => ({ ...o, status: SO_STATUS[o.status ?? ""] ?? o.status, next_inbound: n0(o.shortage) > 0 ? (inb.find(i => i.item_code === o.item_code) ?? null) : undefined })), where: "/sales-orders",
        note: "임시배정은 만료일까지 수주 확정이 없으면 자동 해제된다. 부족 주문은 입고되면 등록 순서대로 배정된다" }; } },
  { name: "get_submission_status", label: "수요자료 제출 현황", roles: ALL_ROLES, description: "수요자료 제출 현황: 대상 월의 마감일, 부서별 제출 여부, 우리 부서가 낸 수요 라인 수와 수량. ym 을 안 주면 다음 달", parameters: obj({ ym: { type: "string", description: "대상 월 YYYY-MM (선택)" } }),
    run: async (sb, a, ctx) => { const ym = /^\d{4}-\d{2}$/.test(str(a.ym)) ? str(a.ym) : nextYm(); const dept = deptOf(ctx.role);
      const [st, lines] = await Promise.all([sb.schema("app").rpc("fn_submission_status", { p_ym: ym }), dept ? sb.schema("analytics").from("v_demand_line").select("customer_name,item_code,description,qty").eq("ym", ym).eq("dept", dept).order("qty", { ascending: false }).limit(500) : Promise.resolve({ data: [] })]);
      const s = st.data as unknown as { ym: string; deadline: string; overdue: boolean; depts: { dept: string; submitted: boolean; submitted_at: string | null; by: string | null }[] | null } | null; const l = lines.data ?? [];
      return { ym, deadline: s?.deadline ?? null, overdue: s?.overdue ?? null, departments: (s?.depts ?? []).map(d => ({ dept: DEPT_KO[d.dept] ?? d.dept, submitted: d.submitted, submitted_at: d.submitted_at, by: d.by })),
        ...(dept ? { my_department: { dept: DEPT_KO[dept], lines: l.length, qty: l.reduce((x, r) => x + n0(r.qty), 0), largest: l.slice(0, 10) } } : {}), where: "/schedule", note: "제출은 일정·제출 화면에서 한다. 마감 전까지 미제출이면 알림이 반복된다" }; } },
  { name: "get_force_alloc", label: "강제 배정 · 우선 배정", roles: ["biz_enable", "scm_lead", "admin"], description: "강제 배정 · 우선 배정: 강제 배정 대상 주문과 주문별로 지금 강제 배정할 수 있는 최대 수량, 품목 한도(현재고의 일정 비율)와 잔여, 승인 대기 중인 우선 배정 건",
    parameters: obj({ item_code: { type: "string" }, customer: { type: "string", description: "고객사 이름 일부" }, top: { type: "integer" } }),
    run: async (sb, a) => { let q = sb.schema("analytics").from("v_force_alloc_pool").select("*"); if (str(a.item_code)) q = q.eq("item_code", str(a.item_code)); if (str(a.customer)) q = q.ilike("customer_name", `%${str(a.customer)}%`);
      const [pool, pri] = await Promise.all([q.order("item_code").order("priority").limit(500), sb.schema("app").from("approval").select("payload,reason,requested_at").eq("kind", "priority_alloc").eq("status", "pending").limit(20)]);
      const rows = (pool.data ?? []).map(r => ({ ...r, qty: n0(r.qty), shortage: n0(r.shortage), available: n0(r.available), on_hand: n0(r.on_hand), item_quota: n0(r.item_quota), item_forced_qty: n0(r.item_forced_qty), customer_forced_qty: n0(r.customer_forced_qty), customer_need: r.customer_need == null ? null : Number(r.customer_need), quota_pct: n0(r.quota_pct) })) as unknown as ForcePoolRow[];
      const items = new Map<string, { item_code: string; description: string | null; on_hand: number; quota: number; used: number; remaining: number; available: number; orders: number }>();
      for (const r of rows) { const i = items.get(r.item_code) ?? { item_code: r.item_code, description: r.description, on_hand: r.on_hand, quota: r.item_quota, used: r.item_forced_qty, remaining: Math.max(0, r.item_quota - r.item_forced_qty), available: r.available, orders: 0 }; i.orders += 1; items.set(r.item_code, i); }
      return { quota_pct: rows[0]?.quota_pct ?? null, orders: rows.length, can_force_now: rows.filter(r => maxForceQty(r) > 0).length, items: [...items.values()].slice(0, topN(a.top)),
        order_list: rows.map(r => ({ order_no: r.order_no, customer: r.customer_name, strategic: r.is_strategic, item_code: r.item_code, qty: r.qty, shortage: r.shortage, max_force_qty: maxForceQty(r) })).sort((x, y) => y.max_force_qty - x.max_force_qty).slice(0, topN(a.top)),
        pending_priority_allocations: (pri.data ?? []).map(p => ({ ...(p.payload as Record<string, unknown>), reason: p.reason, requested_at: p.requested_at })), where: "/allocation/force · /allocation/priority",
        note: "강제 배정 가능 수량 = min(주문 부족, 가용재고, 품목 한도 잔여, 고객사 필요 잔여). 실행은 강제 배정 화면에서 한다" }; } },
  { name: "list_extra_demand", label: "추가 수요 · Bulkdeal", roles: ALL_ROLES, description: "추가 수요 목록: 수주 확정 · 수급회의 승인 · Bulkdeal · 긴급발주. 종류·상태·품목으로 거른다. 승인된 추가 수요는 다음 발주 계획의 필요월 수요에 더해진다",
    parameters: obj({ kind: { type: "string", enum: ["confirmed_order", "meeting_approval", "bulkdeal", "urgent"] }, status: { type: "string", enum: ["pending", "approved", "rejected"] }, item_code: { type: "string" }, top: { type: "integer" } }),
    run: async (sb, a) => { let q = sb.schema("app").from("extra_demand").select("kind,item_code,need_ym,need_date,qty,order_no,customer,model_base,reason,status,requested_dept,created_at,is_dummy", { count: "exact" });
      if (str(a.kind)) q = q.eq("kind", str(a.kind) as "urgent"); if (str(a.status)) q = q.eq("status", str(a.status) as "pending"); if (str(a.item_code)) q = q.eq("item_code", str(a.item_code));
      const r = await q.order("created_at", { ascending: false }).limit(topN(a.top));
      return { total: r.count ?? 0, rows: (r.data ?? []).map(x => ({ ...x, kind: EXTRA_KIND[x.kind] ?? x.kind })), where: "/extra-demand" }; } },

  // ── 마케팅 · 서비스
  { name: "get_group_stock", label: "담당 품목 그룹 재고", roles: ["marketing", "service", "item_manager", "scm_lead", "admin"], description: "담당 품목 그룹 재고(용지 · 카드리더기 등): 그룹별 현재고·가용·가용 0 품목 수와 품목별 재고·DoS. 기본은 우리 부서가 담당하는 그룹, group 을 주면 그 그룹",
    parameters: obj({ group: { type: "string", description: "그룹 이름 일부 (선택)" }, all: { type: "boolean", description: "전 부서 그룹" } }),
    run: async (sb, a, ctx) => { const rows = (await sb.schema("analytics").from("v_group_stock").select("group_code,group_name,owner_dept,is_dummy,item_code,description,on_hand,available,dos_days").order("group_code").order("item_code").limit(1000)).data ?? [];
      const dept = deptOf(ctx.role); const g = str(a.group).toLowerCase();
      let pick = g ? rows.filter(r => (r.group_name ?? "").toLowerCase().includes(g) || (r.group_code ?? "").toLowerCase().includes(g)) : rows;
      if (!g && a.all !== true && dept && pick.some(r => r.owner_dept === dept)) pick = pick.filter(r => r.owner_dept === dept);
      const by = new Map<string, { group: string; owner: string | null; is_dummy: boolean; items: number; on_hand: number; available: number; zero_available: number; list: { item_code: string | null; description: string | null; on_hand: number; available: number; dos_days: number | null }[] }>();
      for (const r of pick) { const k = r.group_code ?? ""; const x = by.get(k) ?? { group: r.group_name ?? k, owner: r.owner_dept ? DEPT_KO[r.owner_dept] ?? r.owner_dept : null, is_dummy: !!r.is_dummy, items: 0, on_hand: 0, available: 0, zero_available: 0, list: [] };
        x.items += 1; x.on_hand += n0(r.on_hand); x.available += n0(r.available); if (n0(r.available) <= 0) x.zero_available += 1; x.list.push({ item_code: r.item_code, description: r.description, on_hand: n0(r.on_hand), available: n0(r.available), dos_days: r.dos_days == null ? null : Number(r.dos_days) }); by.set(k, x); }
      return by.size ? { groups: [...by.values()].map(x => ({ ...x, list: x.list.sort((p, q2) => p.available - q2.available).slice(0, 20) })), where: "/dashboard (담당 품목 재고)", note: "is_dummy = 그룹 구성이 시연용" } : { error: "품목 그룹 없음" }; } },
  { name: "list_urgent_orders", label: "긴급발주 진행", roles: ALL_ROLES, description: "긴급발주 진행: 요청 → 승인 → 발주 접수 → 출하 → 출항 → 입항 → 통관 → 입고 완료 중 어느 단계인지, 지연 여부, 예정일. mine=true 면 내가 요청한 것(없으면 우리 부서)",
    parameters: obj({ mine: { type: "boolean" }, delayed: { type: "boolean" }, item_code: { type: "string" }, top: { type: "integer" } }),
    run: async (sb, a, ctx) => { let q = sb.schema("analytics").from("v_urgent_progress").select("item_code,description,qty,need_date,reason,status,requested_dept,requested_by_name,created_at,po_no,planned_date,actual_date,supplier_name,stage,delayed,is_dummy", { count: "exact" });
      if (str(a.item_code)) q = q.eq("item_code", str(a.item_code)); if (a.delayed === true) q = q.eq("delayed", true);
      if (a.mine === true) q = ctx.name ? q.eq("requested_by_name", ctx.name) : q.eq("requested_dept", deptOf(ctx.role) ?? "");
      const r = await q.order("created_at", { ascending: false }).limit(topN(a.top));
      return { total: r.count ?? 0, rows: (r.data ?? []).map(u => ({ ...u, stage: STAGE_LABEL[u.stage ?? ""] ?? u.stage, requested_dept: u.requested_dept ? DEPT_KO[u.requested_dept] ?? u.requested_dept : null })), where: "/extra-demand",
        note: "긴급발주 요청은 추가 수요 화면 맨 위에서 하고, 팀장 승인 뒤 추가 수요로 반영된다" }; } },
];
export { likeValue };
