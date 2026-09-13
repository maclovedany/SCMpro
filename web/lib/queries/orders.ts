import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
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
/** 재고전개 그리드 행 (R-UI-04): 카테고리 합계(SQL 집계, 전 라인) → 품목(현재 페이지·필터), 행 = 예측/입고/추가/기초/기말/확정 발주 */
export function buildTreeRows(catAgg: CatAgg, lines: Pick<LineRow, "key_code" | "category" | "projection" | "final_qty" | "override_qty" | "need_ym">[], months: string[]) {
  type P = { ym: string; forecast: number; inbound: number; extras: number; start: number; end: number; order: number };
  const byCat = new Map<string, typeof lines>();
  for (const l of lines) { const c = l.category ?? "기타"; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c)!.push(l); }
  const cats = Array.from(new Set([...Object.keys(catAgg), ...byCat.keys()])).sort();
  return cats.map(cat => { const agg = catAgg[cat] ?? {}; const ls = byCat.get(cat) ?? []; const n = Object.values(agg)[0]?.n ?? ls.length;
    const v = (k: "forecast" | "inbound" | "extras" | "end" | "final") => Object.fromEntries(months.map(m => [m, agg[m] ? Number(agg[m][k]) : null]));
    return { id: `cat-${cat}`, label: `${cat} (${n})`, level: 0, values: v("forecast"), children: [
      { id: `cat-${cat}-fc`, label: "예측 합", level: 1, values: v("forecast") }, { id: `cat-${cat}-inb`, label: "입고예정 합", level: 1, values: v("inbound") },
      { id: `cat-${cat}-ex`, label: "추가수요 합", level: 1, values: v("extras") }, { id: `cat-${cat}-end`, label: "기말재고 합", level: 1, values: v("end") },
      { id: `cat-${cat}-ord`, label: "확정 발주 합", level: 1, values: v("final") },
      ...ls.map(l => { const pr = (l.projection as unknown as P[]) ?? []; const iv = (pick: (p: P) => number) => Object.fromEntries(months.map(m => [m, pr.find(p => p.ym === m) ? pick(pr.find(p => p.ym === m)!) : null]));
        return { id: `it-${l.key_code}`, label: l.key_code, level: 1, values: iv(p => p.forecast), children: [
          { id: `it-${l.key_code}-inb`, label: "입고예정", level: 2, values: iv(p => p.inbound) }, { id: `it-${l.key_code}-ex`, label: "추가수요", level: 2, values: iv(p => p.extras) },
          { id: `it-${l.key_code}-st`, label: "기초", level: 2, values: iv(p => p.start) }, { id: `it-${l.key_code}-end`, label: "기말", level: 2, values: iv(p => p.end) },
          { id: `it-${l.key_code}-ord`, label: "확정 발주", level: 2, editable: true, values: Object.fromEntries(months.map(m => [m, m === l.need_ym ? Number(l.override_qty ?? l.final_qty ?? 0) : null])) } ] }; }) ] }; });
}
