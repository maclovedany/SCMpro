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
  charts: { stock_by_cat: { category: string; current: number; target: number; expected_end: number }[]; risk_by_cat_abc: { category: string; abc: string; n: number }[];
    plan_history: { plan_ym: string; status: string; amount: number | null; stockout: number | null }[]; alloc_mix: { temp: number; firm: number; hold: number; waiting: number };
    accuracy_rounds: { finished_at: string; model_wape: string | null; item_wape: string | null }[] };
};
export async function fetchDashboardV2(sb: SupabaseClient<Database>): Promise<DashboardV2> {
  const { data, error } = await withRetry(() => sb.schema("app").rpc("fn_dashboard_v2"));
  if (error) throw new Error(`대시보드 조회 실패 [${error.code}] ${error.message}`);
  return data as unknown as DashboardV2;
}
export type CardSpec = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger" };
export type Section = { key: string; title: string; cards: CardSpec[]; accent: "stock" | "risk" | "cycle" | "forecast" | "ops" | "data" };
const STATUS: Record<string, string> = { draft: "초안", confirmed: "승인 대기", approved: "승인", rejected: "반려" };
const KIND: Record<string, string> = { item_setting: "설정", order_plan: "계획", bulkdeal: "Bulkdeal", priority_alloc: "우선배정", forecast_tuning: "AI", urgent_order: "긴급발주", agent_order: "AI 발주" };
const pct = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const won = (n: number | null | undefined) => (n == null ? "-" : `₩${fmtInt(n)}`);
/** 큰 금액 축약 (KPI 타일용): 234.4억 / 4,821만 */
export const wonCompact = (n: number | null | undefined) => n == null ? "-" : Math.abs(n) >= 1e8 ? `${(n / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e4).toLocaleString("ko-KR")}만` : `₩${fmtInt(n)}`;
export function buildSections(d: DashboardV2): Record<string, Section> {
  const plan = d.cycle.plan; const planHref = plan ? `/orders/${plan.id}` : "/orders";
  const endVsTarget = d.stock.target_amount ? d.stock.expected_end_amount / d.stock.target_amount : null;
  const dosLine = d.dos.map(x => `${x.category} ${fmtInt(x.avg_dos)}일(목표 ${fmtInt(x.avg_target)})`).join(" · ");
  const dosBad = d.dos.some(x => x.avg_dos != null && x.avg_target != null && x.avg_dos < x.avg_target * 0.8);
  const missing = (d.cycle.submission.depts ?? []).filter(x => !x.submitted).length;
  const bt = d.forecast.backtest; const sysW = pct(bt?.model_wape), scmW = pct(bt?.scm_ol_wape), salesW = pct(bt?.sales_ol_wape);
  const prAge = d.forecast.production?.age_days ?? null;
  return {
    stock: { key: "stock", accent: "stock", title: "재고 건전성 (KPI: 월말 재고금액)", cards: [
      { label: "월말 예상 재고금액", value: won(d.stock.expected_end_amount), hint: `목표 ${won(d.stock.target_amount)} · 목표 대비 ${fmtPct(endVsTarget)}${plan ? ` · ${plan.plan_ym} 계획 기준` : ""}`, href: planHref, tone: endVsTarget != null && endVsTarget > 1.3 ? "warn" : "default" },
      { label: "평균 DoS (카테고리별)", value: d.dos.length ? `${fmtInt(d.dos.reduce((a, x) => a + (x.avg_dos ?? 0), 0) / d.dos.length)}일` : "-", hint: dosLine, href: drillHref("/items", { sort: "dos_days.asc" }), tone: dosBad ? "warn" : "default" },
      { label: "과잉 재고 (DoS ≥ 목표 2배)", value: `${fmtInt(d.excess.n)}개`, hint: `묶인 금액 ${won(d.excess.amount)}`, href: drillHref("/items", { sort: "dos_days.desc" }), tone: d.excess.amount > 0 && d.stock.current_amount > 0 && d.excess.amount / d.stock.current_amount > 0.3 ? "warn" : "default" },
    ] },
    risk: { key: "risk", accent: "risk", title: "품절·결품 리스크", cards: [
      { label: "품절 위험 품목", value: fmtInt(d.risk.stockout), hint: `A 등급 ${fmtInt(d.risk.stockout_a)}개 · 필요월 기초재고 < 수요`, href: drillHref(planHref, { risk: true }), tone: d.risk.stockout_a > 0 ? "danger" : d.risk.stockout > 0 ? "warn" : "default" },
      { label: "품절 + 주문 대기", value: fmtInt(d.risk.out_of_stock_with_orders), hint: "가용재고 0 인데 영업 주문이 기다리는 품목", href: "/allocation", tone: d.risk.out_of_stock_with_orders > 0 ? "danger" : "default" },
      { label: "입고 지연 PO", value: fmtInt(d.risk.inbound_delayed.n), hint: `수량 ${fmtInt(d.risk.inbound_delayed.qty)} · 계획일 경과 미입고`, href: "/allocation#inbound", tone: d.risk.inbound_delayed.n > 0 ? "warn" : "default" },
    ] },
    cycle: { key: "cycle", accent: "cycle", title: "이번 달 발주 사이클", cards: [
      { label: plan ? `발주 계획 ${plan.plan_ym}` : "발주 계획", value: plan ? STATUS[plan.status] ?? plan.status : "없음", hint: d.cycle.next_order ? `다음 발주일 ${d.cycle.next_order.date} (D-${d.cycle.next_order.days}) · ${d.cycle.next_order.supplier} · 입고예정 ${d.cycle.next_order.eta}` : "발주 캘린더 없음", href: planHref, tone: !plan ? "danger" : plan.status === "draft" && d.cycle.next_order && d.cycle.next_order.days <= 3 ? "warn" : "default" },
      { label: "총 발주 금액", value: won(plan?.amount), hint: `전월 승인 ${won(d.cycle.prev_amount)}${plan?.amount && d.cycle.prev_amount ? ` (${fmtPct((plan.amount - d.cycle.prev_amount) / d.cycle.prev_amount)})` : ""} · 제출 OL ${won(d.cycle.ol_base_amount)}`, href: plan ? `${planHref}/report` : "/orders" },
      { label: `수요자료 제출 (${d.cycle.submission.ym})`, value: missing ? `미제출 ${missing}부서` : "완료", hint: `마감 ${d.cycle.submission.deadline}${d.cycle.submission.overdue ? " · 마감 경과" : ""}`, href: "/schedule#submission", tone: missing && d.cycle.submission.overdue ? "danger" : missing ? "warn" : "default" },
    ] },
    forecast: { key: "forecast", accent: "forecast", title: "예측 신뢰도", cards: [
      { label: `기준예측 정확도 (WAPE, FY${bt?.eval_fy ? String(bt.eval_fy).slice(2) : "-"})`, value: fmtPct(sysW), hint: `SCM OL ${fmtPct(scmW)} · Sales OL ${fmtPct(salesW)} · 낮을수록 좋음`, href: "/forecast", tone: sysW != null && scmW != null && sysW > scmW ? "warn" : "default" },
      { label: "예측 최신성", value: d.forecast.production ? `${d.forecast.production.train_to} 까지` : "없음", hint: d.forecast.production ? `${fmtDate(d.forecast.production.finished_at)} 실행 · ${prAge}일 전` : "프로덕션 예측을 실행하세요", href: "/forecast/runs", tone: !d.forecast.production || (prAge ?? 0) > 35 ? "warn" : "default" },
      { label: "AI 조정 제안 대기", value: fmtInt(d.forecast.pending_proposals), hint: "검토·승인 필요", href: d.forecast.backtest ? `/forecast/runs/${d.forecast.backtest.id}` : "/forecast/runs", tone: d.forecast.pending_proposals > 0 ? "warn" : "default" },
    ] },
    ops: { key: "ops", accent: "ops", title: "주문·배정 운영", cards: [
      { label: "승인 대기", value: fmtInt(d.ops.approvals_total), hint: d.ops.approvals.length ? d.ops.approvals.map(a => `${KIND[a.kind] ?? a.kind} ${a.n}`).join(" · ") + (d.ops.oldest_pending_hours ? ` · 최장 ${fmtNum(d.ops.oldest_pending_hours, 0)}시간` : "") : "없음", href: "/approvals?status=pending", tone: (d.ops.oldest_pending_hours ?? 0) > 24 ? "danger" : d.ops.approvals_total > 0 ? "warn" : "default" },
      { label: "임시배정 만료 임박 (7일)", value: fmtInt(d.ops.expiring_7d), hint: "수주 확정 없으면 자동 해제", href: "/sales-orders?all=1", tone: d.ops.expiring_7d > 0 ? "warn" : "default" },
      { label: "배정 대기 주문", value: fmtInt(d.ops.waiting.n), hint: `부족 수량 ${fmtInt(d.ops.waiting.shortage)} · 입고 시 순번대로 배정`, href: "/allocation#queue", tone: d.ops.waiting.n > 0 ? "warn" : "default" },
    ] },
    data: { key: "data", accent: "data", title: "데이터 준비 현황 (관리자)", cards: [
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
  if (role !== "admin" && d.data.dummy_items > 0) out.push({ key: "data-warn", accent: "data", title: "안내", cards: [s.data.cards[0]] });
  return out;
}

export type KpiSpec = { label: string; value: string; sub?: string; delta?: { text: string; dir: "up" | "down" | "flat"; good?: boolean }; progress?: { pct: number; label?: string }; href: string; accent: "stock" | "risk" | "cycle" | "forecast" | "ops" | "data"; icon: string; tone?: "default" | "warn" | "danger" };
/** 상단 KPI 스트립 5개 (D-032) — 가장 중요한 숫자, 전월 대비·목표 대비 */
export function buildKpis(d: DashboardV2): KpiSpec[] {
  const plan = d.cycle.plan; const planHref = plan ? `/orders/${plan.id}` : "/orders";
  const endVsTarget = d.stock.target_amount ? d.stock.expected_end_amount / d.stock.target_amount : null;
  const amt = plan?.amount ?? null; const prev = d.cycle.prev_amount; const chg = amt != null && prev ? (amt - prev) / prev : null;
  const bt = d.forecast.backtest; const sysW = pct(bt?.model_wape), scmW = pct(bt?.scm_ol_wape);
  const rounds = d.charts.accuracy_rounds; const prevW = rounds.length >= 2 ? pct(rounds[rounds.length - 2].model_wape) : null;
  const missing = (d.cycle.submission.depts ?? []).filter(x => !x.submitted).length;
  return [
    { label: "월말 예상 재고금액", value: wonCompact(d.stock.expected_end_amount), accent: "stock", icon: "Warehouse", href: planHref, progress: endVsTarget != null ? { pct: Math.min(100, endVsTarget * 100), label: `목표 ${wonCompact(d.stock.target_amount)} 대비 ${fmtPct(endVsTarget)}` } : undefined, tone: endVsTarget != null && endVsTarget > 1.3 ? "warn" : "default" },
    { label: "품절 위험 품목", value: fmtInt(d.risk.stockout), accent: "risk", icon: "AlertTriangle", href: drillHref(planHref, { risk: true }), sub: `A 등급 ${fmtInt(d.risk.stockout_a)} · 품절+주문 대기 ${fmtInt(d.risk.out_of_stock_with_orders)}`, tone: d.risk.stockout_a > 0 ? "danger" : d.risk.stockout > 0 ? "warn" : "default" },
    { label: plan ? `발주 금액 (${plan.plan_ym})` : "발주 금액", value: wonCompact(amt), accent: "cycle", icon: "ClipboardList", href: plan ? `${planHref}/report` : "/orders", delta: chg != null ? { text: `전월 대비 ${fmtPct(Math.abs(chg))}`, dir: chg > 0.005 ? "up" : chg < -0.005 ? "down" : "flat", good: chg <= 0 } : undefined, sub: plan ? `${STATUS[plan.status] ?? plan.status}${d.cycle.next_order ? ` · 발주일 D-${d.cycle.next_order.days}` : ""}` : "계획 없음", tone: !plan ? "danger" : "default" },
    { label: "기준예측 정확도 (WAPE)", value: fmtPct(sysW), accent: "forecast", icon: "Target", href: "/forecast", delta: sysW != null && prevW != null ? { text: `직전 라운드 대비 ${fmtPct(Math.abs(sysW - prevW))}`, dir: sysW < prevW - 0.001 ? "down" : sysW > prevW + 0.001 ? "up" : "flat", good: sysW <= prevW } : undefined, sub: scmW != null ? `SCM OL ${fmtPct(scmW)} 보다 ${fmtPct(scmW - (sysW ?? 0))}p 정확` : undefined, tone: sysW != null && scmW != null && sysW > scmW ? "warn" : "default" },
    { label: "승인 대기 · 미제출", value: `${fmtInt(d.ops.approvals_total)} · ${missing}`, accent: "ops", icon: "CheckSquare", href: "/approvals?status=pending", sub: `${d.ops.oldest_pending_hours ? `최장 ${fmtNum(d.ops.oldest_pending_hours, 0)}시간 대기 · ` : ""}수요자료 미제출 ${missing}부서`, tone: (d.ops.oldest_pending_hours ?? 0) > 24 || (missing && d.cycle.submission.overdue) ? "danger" : d.ops.approvals_total > 0 || missing ? "warn" : "default" },
  ];
}
/** 차트 데이터 가공 (표시용) */
export function chartData(d: DashboardV2) {
  const c = d.charts; const cats = Array.from(new Set(c.stock_by_cat.map(x => x.category))).sort();
  const riskCats = Array.from(new Set(c.risk_by_cat_abc.map(x => x.category))).sort();
  const riskTotal = c.risk_by_cat_abc.reduce((a, x) => a + x.n, 0); const riskA = c.risk_by_cat_abc.filter(x => x.abc === "A").reduce((a, x) => a + x.n, 0);
  const worst = cats.map(k => { const x = c.stock_by_cat.find(y => y.category === k)!; return { k, r: x.target ? x.expected_end / x.target : 0 }; }).sort((a, b) => b.r - a.r)[0];
  return {
    stock: { categories: cats, series: [{ name: "현재고", data: cats.map(k => c.stock_by_cat.find(x => x.category === k)?.current ?? 0) }, { name: "목표 재고", data: cats.map(k => c.stock_by_cat.find(x => x.category === k)?.target ?? 0) }, { name: "예상 월말", data: cats.map(k => c.stock_by_cat.find(x => x.category === k)?.expected_end ?? 0) }],
      insight: worst ? `${worst.k} 의 예상 월말 재고가 목표의 ${fmtPct(worst.r)} — 가장 높음` : "계획 없음" },
    risk: { categories: riskCats, series: ["A", "B", "C"].map(g => ({ name: `${g} 등급`, data: riskCats.map(k => c.risk_by_cat_abc.find(x => x.category === k && x.abc === g)?.n ?? 0) })),
      insight: riskTotal ? `품절 위험 ${fmtInt(riskTotal)}개 중 A 등급 ${fmtInt(riskA)}개 (${fmtPct(riskA / riskTotal)}) — 먼저 처리` : "품절 위험 없음" },
    cycle: { x: c.plan_history.map(h => h.plan_ym), series: [{ name: "발주 금액", data: c.plan_history.map(h => h.amount) }], insight: c.plan_history.length > 1 ? `최근 ${c.plan_history.length}개월 계획 금액 추이` : "이력이 쌓이면 월별 추이가 표시됩니다" },
    forecast: { labels: ["시스템 기준예측", "Sales OL", "SCM OL"], values: [pct(d.forecast.backtest?.model_wape) ?? 0, pct(d.forecast.backtest?.sales_ol_wape) ?? 0, pct(d.forecast.backtest?.scm_ol_wape) ?? 0],
      insight: d.forecast.backtest ? `FY${String(d.forecast.backtest.eval_fy).slice(2)} 백테스트 · 낮을수록 정확` : "백테스트 없음" },
    ops: { data: [{ name: "임시배정", value: c.alloc_mix.temp }, { name: "확정배정", value: c.alloc_mix.firm }, { name: "승인대기 확보", value: c.alloc_mix.hold }, { name: "배정 대기(부족)", value: c.alloc_mix.waiting }],
      insight: c.alloc_mix.waiting > 0 ? `부족 ${fmtInt(c.alloc_mix.waiting)}개가 입고를 기다리는 중` : "배정 대기 없음" },
  };
}
