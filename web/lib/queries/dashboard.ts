import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct, fmtDate, fmtNum } from "@/lib/format";
import { withRetry } from "@/lib/supabase/retry";
import type { Role } from "@/lib/auth/roles";
/** SCM 관점 대시보드 (D-031): 5묶음 + 데이터 준비 현황. RPC fn_dashboard_v2 한 번 */
export type DashboardV2 = {
  stock: { expected_end_amount: number; target_amount: number; current_amount: number };
  dos: { category: string; avg_dos: number | null; avg_target: number | null; n: number }[];
  excess: { n: number; amount: number };
  risk: { stockout: number; stockout_a: number; out_of_stock_with_orders: number; inbound_delayed: { n: number; qty: number } };
  cycle: { plan: { id: string; plan_ym: string; status: string; amount: number | null; created_at: string } | null; prev_amount: number | null; ol_base_amount: number;
    next_order: { date: string; supplier: string; eta: string; days: number } | null; submission: { ym: string; deadline: string; overdue: boolean; depts: { dept: string; submitted: boolean }[] | null } };
  forecast: { backtest: { id: string; eval_fy: number | null; finished_at: string; model_wape: string | null; item_wape: string | null; scm_ol_wape: string | null; sales_ol_wape: string | null } | null;
    production: { id: string; train_to: string; finished_at: string; age_days: number } | null; pending_proposals: number };
  ops: { approvals: { kind: string; n: number }[]; approvals_total: number; oldest_pending_hours: number | null; expiring_7d: number; waiting: { n: number; shortage: number } };
  data: { items_by_category: Record<string, number>; dummy_items: number; dummy_stock: number; missing_target_dos: number; snapshot_date: string | null; last_upload: { file_name: string; uploaded_at: string; ok_count: number; error_count: number } | null };
};
export async function fetchDashboardV2(sb: SupabaseClient<Database>): Promise<DashboardV2> {
  const { data, error } = await withRetry(() => sb.schema("app").rpc("fn_dashboard_v2"));
  if (error) throw new Error(`대시보드 조회 실패 [${error.code}] ${error.message}`);
  return data as unknown as DashboardV2;
}
export type CardSpec = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger" };
export type Section = { key: string; title: string; cards: CardSpec[] };
const STATUS: Record<string, string> = { draft: "초안", confirmed: "승인 대기", approved: "승인", rejected: "반려" };
const KIND: Record<string, string> = { item_setting: "설정", order_plan: "계획", bulkdeal: "Bulkdeal", priority_alloc: "우선배정", forecast_tuning: "AI" };
const pct = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const won = (n: number | null | undefined) => (n == null ? "-" : `₩${fmtInt(n)}`);
export function buildSections(d: DashboardV2): Record<string, Section> {
  const plan = d.cycle.plan; const planHref = plan ? `/orders/${plan.id}` : "/orders";
  const endVsTarget = d.stock.target_amount ? d.stock.expected_end_amount / d.stock.target_amount : null;
  const dosLine = d.dos.map(x => `${x.category} ${fmtInt(x.avg_dos)}일(목표 ${fmtInt(x.avg_target)})`).join(" · ");
  const dosBad = d.dos.some(x => x.avg_dos != null && x.avg_target != null && x.avg_dos < x.avg_target * 0.8);
  const missing = (d.cycle.submission.depts ?? []).filter(x => !x.submitted).length;
  const bt = d.forecast.backtest; const sysW = pct(bt?.model_wape), scmW = pct(bt?.scm_ol_wape), salesW = pct(bt?.sales_ol_wape);
  const prAge = d.forecast.production?.age_days ?? null;
  return {
    stock: { key: "stock", title: "재고 건전성 (KPI: 월말 재고금액)", cards: [
      { label: "월말 예상 재고금액", value: won(d.stock.expected_end_amount), hint: `목표 ${won(d.stock.target_amount)} · 목표 대비 ${fmtPct(endVsTarget)}${plan ? ` · ${plan.plan_ym} 계획 기준` : ""}`, href: planHref, tone: endVsTarget != null && endVsTarget > 1.3 ? "warn" : "default" },
      { label: "평균 DoS (카테고리별)", value: d.dos.length ? `${fmtInt(d.dos.reduce((a, x) => a + (x.avg_dos ?? 0), 0) / d.dos.length)}일` : "-", hint: dosLine, href: drillHref("/items", { sort: "dos_days.asc" }), tone: dosBad ? "warn" : "default" },
      { label: "과잉 재고 (DoS ≥ 목표 2배)", value: `${fmtInt(d.excess.n)}개`, hint: `묶인 금액 ${won(d.excess.amount)}`, href: drillHref("/items", { sort: "dos_days.desc" }), tone: d.excess.amount > 0 && d.stock.current_amount > 0 && d.excess.amount / d.stock.current_amount > 0.3 ? "warn" : "default" },
    ] },
    risk: { key: "risk", title: "품절·결품 리스크", cards: [
      { label: "품절 위험 품목", value: fmtInt(d.risk.stockout), hint: `A 등급 ${fmtInt(d.risk.stockout_a)}개 · 필요월 기초재고 < 수요`, href: drillHref(planHref, { risk: true }), tone: d.risk.stockout_a > 0 ? "danger" : d.risk.stockout > 0 ? "warn" : "default" },
      { label: "품절 + 주문 대기", value: fmtInt(d.risk.out_of_stock_with_orders), hint: "가용재고 0 인데 영업 주문이 기다리는 품목", href: "/allocation", tone: d.risk.out_of_stock_with_orders > 0 ? "danger" : "default" },
      { label: "입고 지연 PO", value: fmtInt(d.risk.inbound_delayed.n), hint: `수량 ${fmtInt(d.risk.inbound_delayed.qty)} · 계획일 경과 미입고`, href: "/allocation#inbound", tone: d.risk.inbound_delayed.n > 0 ? "warn" : "default" },
    ] },
    cycle: { key: "cycle", title: "이번 달 발주 사이클", cards: [
      { label: plan ? `발주 계획 ${plan.plan_ym}` : "발주 계획", value: plan ? STATUS[plan.status] ?? plan.status : "없음", hint: d.cycle.next_order ? `다음 발주일 ${d.cycle.next_order.date} (D-${d.cycle.next_order.days}) · ${d.cycle.next_order.supplier} · 입고예정 ${d.cycle.next_order.eta}` : "발주 캘린더 없음", href: planHref, tone: !plan ? "danger" : plan.status === "draft" && d.cycle.next_order && d.cycle.next_order.days <= 3 ? "warn" : "default" },
      { label: "총 발주 금액", value: won(plan?.amount), hint: `전월 승인 ${won(d.cycle.prev_amount)}${plan?.amount && d.cycle.prev_amount ? ` (${fmtPct((plan.amount - d.cycle.prev_amount) / d.cycle.prev_amount)})` : ""} · 제출 OL ${won(d.cycle.ol_base_amount)}`, href: plan ? `${planHref}/report` : "/orders" },
      { label: `수요자료 제출 (${d.cycle.submission.ym})`, value: missing ? `미제출 ${missing}부서` : "완료", hint: `마감 ${d.cycle.submission.deadline}${d.cycle.submission.overdue ? " · 마감 경과" : ""}`, href: "/schedule#submission", tone: missing && d.cycle.submission.overdue ? "danger" : missing ? "warn" : "default" },
    ] },
    forecast: { key: "forecast", title: "예측 신뢰도", cards: [
      { label: `기준예측 정확도 (WAPE, FY${bt?.eval_fy ? String(bt.eval_fy).slice(2) : "-"})`, value: fmtPct(sysW), hint: `SCM OL ${fmtPct(scmW)} · Sales OL ${fmtPct(salesW)} · 낮을수록 좋음`, href: "/forecast", tone: sysW != null && scmW != null && sysW > scmW ? "warn" : "default" },
      { label: "예측 최신성", value: d.forecast.production ? `${d.forecast.production.train_to} 까지` : "없음", hint: d.forecast.production ? `${fmtDate(d.forecast.production.finished_at)} 실행 · ${prAge}일 전` : "프로덕션 예측을 실행하세요", href: "/forecast/runs", tone: !d.forecast.production || (prAge ?? 0) > 35 ? "warn" : "default" },
      { label: "AI 조정 제안 대기", value: fmtInt(d.forecast.pending_proposals), hint: "검토·승인 필요", href: d.forecast.backtest ? `/forecast/runs/${d.forecast.backtest.id}` : "/forecast/runs", tone: d.forecast.pending_proposals > 0 ? "warn" : "default" },
    ] },
    ops: { key: "ops", title: "주문·배정 운영", cards: [
      { label: "승인 대기", value: fmtInt(d.ops.approvals_total), hint: d.ops.approvals.length ? d.ops.approvals.map(a => `${KIND[a.kind] ?? a.kind} ${a.n}`).join(" · ") + (d.ops.oldest_pending_hours ? ` · 최장 ${fmtNum(d.ops.oldest_pending_hours, 0)}시간` : "") : "없음", href: "/approvals?status=pending", tone: (d.ops.oldest_pending_hours ?? 0) > 24 ? "danger" : d.ops.approvals_total > 0 ? "warn" : "default" },
      { label: "임시배정 만료 임박 (7일)", value: fmtInt(d.ops.expiring_7d), hint: "수주 확정 없으면 자동 해제", href: "/sales-orders?all=1", tone: d.ops.expiring_7d > 0 ? "warn" : "default" },
      { label: "배정 대기 주문", value: fmtInt(d.ops.waiting.n), hint: `부족 수량 ${fmtInt(d.ops.waiting.shortage)} · 입고 시 순번대로 배정`, href: "/allocation#queue", tone: d.ops.waiting.n > 0 ? "warn" : "default" },
    ] },
    data: { key: "data", title: "데이터 준비 현황 (관리자)", cards: [
      { label: "기준 데이터 미입력(더미) 품목", value: fmtInt(Math.max(d.data.dummy_items, d.data.dummy_stock)), hint: `설정 ${fmtInt(d.data.dummy_items)} · 재고 ${fmtInt(d.data.dummy_stock)} — 실데이터 업로드로 0 이 목표`, href: drillHref("/items", { dummy: true }), tone: d.data.dummy_items > 0 ? "warn" : "default" },
      { label: "목표 DoS 미설정", value: fmtInt(d.data.missing_target_dos), hint: "발주 확정 차단 대상", href: drillHref("/items", { target_dos: "missing" }), tone: d.data.missing_target_dos > 0 ? "danger" : "default" },
      { label: "재고 스냅샷 기준일", value: fmtDate(d.data.snapshot_date), hint: d.data.last_upload ? `최근 업로드 ${d.data.last_upload.file_name} (성공 ${d.data.last_upload.ok_count}/오류 ${d.data.last_upload.error_count})` : "업로드 이력 없음", href: "/upload?tab=log" },
    ] },
  };
}
/** 역할별 섹션 순서 (R-UI-12) */
export function sectionsForRole(role: Role, d: DashboardV2): Section[] {
  const s = buildSections(d);
  const order: Record<Role, string[]> = {
    scm_lead: ["stock", "cycle", "forecast", "risk", "ops"], item_manager: ["risk", "cycle", "ops", "stock", "forecast"], admin: ["risk", "cycle", "stock", "forecast", "ops", "data"],
    sales: ["ops", "risk", "cycle"], biz_enable: ["ops", "risk"], marketing: ["cycle", "risk", "stock"], service: ["cycle", "risk", "stock"],
  };
  const out = order[role].map(k => s[k]);
  if (role !== "admin" && d.data.dummy_items > 0) out.push({ key: "data-warn", title: "안내", cards: [s.data.cards[0]] });
  return out;
}
