import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { TreeRow } from "@/components/tables/TreeGrid";
type SB = SupabaseClient<Database>;
export type PlanRow = Database["analytics"]["Views"]["v_order_plan_summary"]["Row"];
export type LineRow = Database["app"]["Tables"]["order_plan_line"]["Row"];
export async function fetchPlans(sb: SB) {
  const { data } = await sb.schema("analytics").from("v_order_plan_summary").select("*").order("plan_ym", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}
export const LINE_PAGE = 500;
export async function fetchPlan(sb: SB, id: string, f: LineFilters = {}, page = 1) {
  let q = sb.schema("app").from("order_plan_line").select("*", { count: "exact" }).eq("plan_id", id);
  if (f.risk) q = q.eq("stockout_risk", true);
  if (f.blocked) q = q.eq("blocked", true);
  if (f.flex) q = q.eq("flex_hit", true);
  if (f.category) q = q.eq("category", f.category);
  if (f.q) q = q.ilike("key_code", `%${f.q}%`);
  const [plan, lines, cat] = await Promise.all([
    sb.schema("app").from("order_plan").select("*").eq("id", id).maybeSingle(),
    q.order("amount", { ascending: false }).range((page - 1) * LINE_PAGE, page * LINE_PAGE - 1),
    sb.schema("app").rpc("fn_plan_cat_projection", { p_plan_id: id }),
  ]);
  return { plan: plan.data, lines: lines.data ?? [], count: lines.count ?? 0, catAgg: (cat.data ?? {}) as unknown as CatAgg };
}
export type CatAgg = Record<string, Record<string, { forecast: number; inbound: number; extras: number; end: number; order: number; final: number; n: number }>>;
export async function fetchPrevApprovedPlan(sb: SB, planYm: string) {
  const { data } = await sb.schema("analytics").from("v_order_plan_summary").select("*").eq("status", "approved").lt("plan_ym", planYm).order("plan_ym", { ascending: false }).limit(1).maybeSingle();
  return data;
}
export async function fetchExtraDemand(sb: SB) {
  const { data } = await sb.schema("app").from("extra_demand").select("*").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}
export type LineFilters = { risk?: boolean; blocked?: boolean; flex?: boolean; category?: string; q?: string };
export function filterLines<T extends { stockout_risk: boolean | null; blocked: boolean | null; flex_hit: boolean | null; category: string | null; key_code: string }>(lines: T[], f: LineFilters) {
  return lines.filter(l => (!f.risk || l.stockout_risk) && (!f.blocked || l.blocked) && (!f.flex || l.flex_hit) && (!f.category || l.category === f.category) && (!f.q || l.key_code.includes(f.q)));
}
/** 재고전개 그리드 행 (R-UI-04, D-050): 카테고리 합계(SQL 집계, 전 라인) → 품목(현재 페이지·필터).
 *  행은 산식 순서로 읽힌다: 기초 + 입고예정 − 예측 판매 − 추가수요 + 확정 발주 = 기말. 차감 행은 음수로 표시해 위에서 아래로 더하면 기말이 나온다. 부모 행 값 = 기말. */
export function buildTreeRows(catAgg: CatAgg, lines: Pick<LineRow, "key_code" | "category" | "projection" | "final_qty" | "override_qty" | "need_ym">[], months: string[]): TreeRow[] {
  type P = { ym: string; forecast: number; inbound: number; extras: number; start: number; end: number; order: number };
  const neg = (v: number | null) => (v == null ? null : v === 0 ? 0 : -v);
  const byCat = new Map<string, typeof lines>();
  for (const l of lines) { const c = l.category ?? "기타"; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c)!.push(l); }
  const cats = Array.from(new Set([...Object.keys(catAgg), ...byCat.keys()])).sort();
  return cats.map(cat => { const agg = catAgg[cat] ?? {}; const ls = byCat.get(cat) ?? []; const n = Object.values(agg)[0]?.n ?? ls.length;
    const v = (k: "forecast" | "inbound" | "extras" | "end" | "final", sign: 1 | -1 = 1) => Object.fromEntries(months.map(m => [m, agg[m] ? (sign < 0 ? neg(Number(agg[m][k])) : Number(agg[m][k])) : null]));
    return { id: `cat-${cat}`, label: `${cat} (${n}) — 기말재고 합`, level: 0, values: v("end"), children: [
      { id: `cat-${cat}-inb`, label: "＋ 입고예정 합", level: 1, values: v("inbound") },
      { id: `cat-${cat}-fc`, label: "− 예측 판매 합", level: 1, values: v("forecast", -1) },
      { id: `cat-${cat}-ex`, label: "− 추가수요 합", level: 1, values: v("extras", -1) },
      { id: `cat-${cat}-ord`, label: "＋ 확정 발주 합", level: 1, values: v("final") },
      { id: `cat-${cat}-end`, label: "＝ 기말재고 합", level: 1, values: v("end"), className: "font-semibold" },
      ...ls.map(l => { const pr = (l.projection as unknown as P[]) ?? []; const iv = (pick: (p: P) => number, sign: 1 | -1 = 1) => Object.fromEntries(months.map(m => { const q = pr.find(p => p.ym === m); return [m, q ? (sign < 0 ? neg(pick(q)) : pick(q)) : null]; }));
        return { id: `it-${l.key_code}`, label: l.key_code, level: 1, values: iv(p => p.end), children: [
          { id: `it-${l.key_code}-st`, label: "기초", level: 2, values: iv(p => p.start) },
          { id: `it-${l.key_code}-inb`, label: "＋ 입고예정", level: 2, values: iv(p => p.inbound) },
          { id: `it-${l.key_code}-fc`, label: "− 예측 판매", level: 2, values: iv(p => p.forecast, -1) },
          { id: `it-${l.key_code}-ex`, label: "− 추가수요", level: 2, values: iv(p => p.extras, -1) },
          { id: `it-${l.key_code}-ord`, label: "＋ 확정 발주", level: 2, editable: true, values: Object.fromEntries(months.map(m => [m, m === l.need_ym ? Number(l.override_qty ?? l.final_qty ?? 0) : null])) },
          { id: `it-${l.key_code}-end`, label: "＝ 기말", level: 2, values: iv(p => p.end), className: "font-semibold" } ] }; }) ] }; });
}

/** 발주 계획 개요 (D-035): RPC fn_plan_overview 한 번 — 카테고리·공급처·필요월·상위 품목·리스크 */
export type PlanOverview = {
  by_category: { category: string; n: number; qty: number; amount: number; stockout: number; blocked: number; flex_hit: number; ol_base_amount: number; required_amount: number }[];
  by_supplier: { supplier: string; n: number; amount: number }[];
  by_need_ym: { need_ym: string; category: string; n: number; amount: number }[];
  top_items: { key_code: string; category: string | null; qty: number; amount: number | null; stockout_risk: boolean; overridden: boolean }[];
  risk_by_cat_abc: { category: string; abc: string; n: number }[];
};
export async function fetchPlanOverview(sb: SB, planId: string): Promise<PlanOverview> {
  const { data, error } = await sb.schema("app").rpc("fn_plan_overview", { p_plan_id: planId });
  if (error) throw error;
  const d = (data ?? {}) as Partial<PlanOverview>;
  return { by_category: d.by_category ?? [], by_supplier: d.by_supplier ?? [], by_need_ym: d.by_need_ym ?? [], top_items: d.top_items ?? [], risk_by_cat_abc: d.risk_by_cat_abc ?? [] };
}
const won = (n: number) => (Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`);
/** 계획 개요 → 차트 데이터 (순수 함수) */
export function planCharts(o: PlanOverview) {
  const cats = o.by_category.map(c => c.category);
  const total = o.by_category.reduce((a, c) => a + Number(c.amount), 0);
  const topCat = [...o.by_category].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const months = Array.from(new Set(o.by_need_ym.map(x => x.need_ym))).sort();
  const firstShare = months[0] ? o.by_need_ym.filter(x => x.need_ym === months[0]).reduce((a, x) => a + Number(x.amount), 0) / Math.max(1, total) : 0;
  const topSup = o.by_supplier[0];
  const riskTotal = o.risk_by_cat_abc.reduce((a, r) => a + r.n, 0), riskA = o.risk_by_cat_abc.filter(r => r.abc === "A").reduce((a, r) => a + r.n, 0);
  const olDelta = o.by_category.reduce((a, c) => a + Number(c.required_amount) - Number(c.ol_base_amount), 0), olBase = o.by_category.reduce((a, c) => a + Number(c.ol_base_amount), 0);
  return {
    category: { data: o.by_category.map(c => ({ name: c.category, value: Math.round(Number(c.amount)) })), insight: topCat ? `${topCat.category} 이 ${won(Number(topCat.amount))} (${Math.round(100 * Number(topCat.amount) / Math.max(1, total))}%) 으로 최대 · 제출 OL 대비 필요량 ${olBase ? `${olDelta >= 0 ? "+" : ""}${Math.round(1000 * olDelta / olBase) / 10}%` : "-"}` : "라인 없음" },
    supplier: { labels: o.by_supplier.map(s => s.supplier), values: o.by_supplier.map(s => Math.round(Number(s.amount))), insight: topSup ? `${topSup.supplier} ${won(Number(topSup.amount))} · ${topSup.n.toLocaleString("ko-KR")} 품목 — 출항 일정 확인 우선` : "-" },
    needYm: { categories: months, series: cats.map(c => ({ name: c, data: months.map(m => Math.round(Number(o.by_need_ym.find(x => x.need_ym === m && x.category === c)?.amount ?? 0))) })), insight: months[0] ? `${months[0]} 필요분이 금액의 ${Math.round(firstShare * 100)}% — 리드타임상 이번 달 발주 필수` : "-" },
    topItems: { labels: o.top_items.map(t => t.key_code), values: o.top_items.map(t => Math.round(Number(t.amount ?? 0))), flags: o.top_items.map(t => t.stockout_risk), insight: o.top_items[0] ? `${o.top_items[0].key_code} 한 품목이 ${won(Number(o.top_items[0].amount ?? 0))} · 상위 10 품목 = ${Math.round(100 * o.top_items.reduce((a, t) => a + Number(t.amount ?? 0), 0) / Math.max(1, total))}%` : "-" },
    risk: { categories: cats, series: ["A", "B", "C"].map(abc => ({ name: `${abc} 등급`, data: cats.map(c => o.risk_by_cat_abc.find(r => r.category === c && r.abc === abc)?.n ?? 0) })), insight: riskTotal ? `품절 위험 ${riskTotal.toLocaleString("ko-KR")}개 중 A 등급 ${riskA}개 — 오버라이드·긴급 발주 검토` : "품절 위험 없음" },
    total,
  };
}
export type PlanCharts = ReturnType<typeof planCharts>;
/** 계획 이력 차트: 발주월별 대표 계획(승인 > 최신) 금액·품절 */
export function planHistory(plans: PlanRow[]) {
  const by = new Map<string, PlanRow>();
  for (const p of [...plans].sort((a, b) => (a.plan_ym! > b.plan_ym! ? 1 : -1))) { const cur = by.get(p.plan_ym!); if (!cur || (p.status === "approved" && cur.status !== "approved")) by.set(p.plan_ym!, p); }
  const rows = [...by.values()].sort((a, b) => (a.plan_ym! > b.plan_ym! ? 1 : -1));
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const d = last && prev && Number(prev.amount) ? (Number(last.amount) - Number(prev.amount)) / Number(prev.amount) : null;
  return { x: rows.map(r => r.plan_ym!), amount: rows.map(r => Number(r.amount)), status: rows.map(r => r.status ?? ""), stockout: rows.map(r => Number(((r.summary ?? {}) as Record<string, number>).stockout ?? 0)),
    insight: d == null ? (last ? `${last.plan_ym} 계획 ${won(Number(last.amount))} — 비교할 전월 계획 없음` : "계획 없음") : `${last.plan_ym} 는 ${prev.plan_ym} 대비 ${d >= 0 ? "+" : ""}${Math.round(d * 1000) / 10}% (${won(Number(last.amount))})` };
}

/** 지난 계획 사후 채점 (D-044): RPC fn_plan_scorecard — 필요월 실적이 있는 라인만. 없으면 scored=0 */
export type PlanScorecard = {
  scored: number; last_ym: string | null;
  human: { stockout: number; excess: number; ok: number }; system: { stockout: number; excess: number; ok: number };
  overrides: { n: number; improved: number; worsened: number; same: number };
  by_category: { category: string; scored: number; h_stockout: number; h_excess: number; s_stockout: number; s_excess: number }[];
  worst: { key_code: string; category: string | null; abc: string | null; need_ym: string; proposed: number; ordered: number; actual: number; realized_end: number; sys_end: number; outcome_h: string; outcome_s: string; override_reason: string | null }[];
};
export async function fetchPlanScorecard(sb: SB, planId: string): Promise<PlanScorecard> {
  const { data, error } = await sb.schema("app").rpc("fn_plan_scorecard", { p_plan_id: planId });
  if (error) throw error;
  const d = (data ?? {}) as Partial<PlanScorecard>;
  return { scored: Number(d.scored ?? 0), last_ym: d.last_ym ?? null, human: d.human ?? { stockout: 0, excess: 0, ok: 0 }, system: d.system ?? { stockout: 0, excess: 0, ok: 0 },
    overrides: d.overrides ?? { n: 0, improved: 0, worsened: 0, same: 0 }, by_category: d.by_category ?? [], worst: d.worst ?? [] };
}
export const OUTCOME_LABEL: Record<string, string> = { stockout: "결품", excess: "과잉", ok: "적정" };
/** 채점 해석 한 줄 (순수 함수) */
export function scorecardInsight(s: PlanScorecard): string {
  if (!s.scored) return "필요월 실적이 아직 없어 채점 전 — 실적이 쌓이면 자동으로 채점됩니다";
  const hs = Math.round(100 * (s.human.stockout + s.human.excess) / s.scored), ss = Math.round(100 * (s.system.stockout + s.system.excess) / s.scored);
  const ov = s.overrides.n ? ` · 오버라이드 ${s.overrides.n}건 중 개선 ${s.overrides.improved} / 악화 ${s.overrides.worsened}` : "";
  return `${s.scored}라인 채점 (실적 ${s.last_ym} 까지): 실제 발주 결품·과잉 ${hs}% vs 시스템 제안대로면 ${ss}%${ov}`;
}
