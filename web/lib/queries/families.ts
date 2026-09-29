/** 제품군·기종 기준으로 보기 (D-076, R-UI-18): 필터(제품군 · 기종)와 묶어 보기(제품군별 · 기종별 요약) */
import { catLabel } from "@/lib/design/category";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { anonNamesOf, realName, type AliasMap } from "@/lib/names";
type SB = SupabaseClient<Database>;
/** family = 화면에서 고른 제품군 이름(실제 이름 또는 저장된 이름), model = 기종 묶음 코드(저장된 값, 예: MDL901) */
export type FamilyFilters = { family?: string; model?: string };
export function parseFamilyFilters(sp: Record<string, string | undefined>): FamilyFilters {
  const family = sp.family?.trim(); const model = sp.model?.trim().toUpperCase();
  return { ...(family ? { family } : {}), ...(model ? { model } : {}) };
}
/** PostgREST in.(…) 목록: 이름에 쉼표·괄호·따옴표가 들어가므로 전부 따옴표로 감싸고 \\ 와 " 는 이스케이프 */
export const inList = (values: string[]) => `(${values.map(v => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
/** 제품군 = 저장된 이름 목록으로 바꿔 조회, 기종 = 연결 기종(link_models)에 포함. 대상 뷰는 v_item_master_x · v_order_plan_line_x */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFamilyFilters(q: any, g: FamilyFilters, names: AliasMap) {
  if (g.family) q = q.filter("family", "in", inList(anonNamesOf(names, "family", g.family)));
  if (g.model) q = q.contains("link_models", [g.model]);
  return q;
}
/** 필터 표시 문구 (실제 이름으로) */
export function familyChips(g: FamilyFilters, names: AliasMap): { k: "family" | "model"; label: string }[] {
  return [...(g.family ? [{ k: "family" as const, label: `제품군: ${realName(names, "family", g.family)}` }] : []),
          ...(g.model ? [{ k: "model" as const, label: `기종: ${realName(names, "codename", g.model)}` }] : [])];
}
export type FamilySummaryRow = { key: string; name: string; category: string | null; n_items: number; on_hand: number; inbound_qty: number; avg_6m: number; total_12m: number; n_zero_stock: number; n_below_target: number };
export type FamilyGroup = Omit<FamilySummaryRow, "category"> & { categories: string; dos_days: number | null };
const n = (v: number | string | null | undefined) => Number(v ?? 0);
/** 카테고리로 나뉜 요약 행을 이름 하나당 한 줄로 합친다. DoS = 현재고 ÷ 6개월 평균 × 30. 12개월 출고 큰 순 */
export function byModel(rows: FamilySummaryRow[]): FamilyGroup[] {
  const m = new Map<string, FamilyGroup & { cats: Set<string> }>();
  for (const r of rows) {
    const g = m.get(r.key) ?? { key: r.key, name: r.name, categories: "", cats: new Set<string>(), n_items: 0, on_hand: 0, inbound_qty: 0, avg_6m: 0, total_12m: 0, n_zero_stock: 0, n_below_target: 0, dos_days: null };
    g.n_items += n(r.n_items); g.on_hand += n(r.on_hand); g.inbound_qty += n(r.inbound_qty); g.avg_6m += n(r.avg_6m); g.total_12m += n(r.total_12m); g.n_zero_stock += n(r.n_zero_stock); g.n_below_target += n(r.n_below_target);
    if (r.category) g.cats.add(r.category); m.set(r.key, g);
  }
  return [...m.values()].map(({ cats, ...g }) => ({ ...g, categories: [...cats].sort().map(catLabel).join(" · "), dos_days: g.avg_6m > 0 ? Math.round(g.on_hand / g.avg_6m * 30) : null })).sort((a, b) => b.total_12m - a.total_12m || a.name.localeCompare(b.name));
}
/** 품목 › 제품군별 / 기종별 요약 (각 1,000행 안) */
export async function fetchFamilySummary(sb: SB, by: "family" | "model", category?: string): Promise<FamilySummaryRow[]> {
  if (by === "model") {
    let q = sb.schema("analytics").from("v_model_item_summary").select("*"); if (category) q = q.eq("category", category);
    return ((await q.limit(1000)).data ?? []).map(r => ({ key: r.model_base!, name: r.codename ?? r.model_base!, category: r.category, n_items: n(r.n_items), on_hand: n(r.on_hand), inbound_qty: n(r.inbound_qty), avg_6m: n(r.avg_6m), total_12m: n(r.total_12m), n_zero_stock: n(r.n_zero_stock), n_below_target: n(r.n_below_target) }));
  }
  let q = sb.schema("analytics").from("v_family_summary").select("*"); if (category) q = q.eq("category", category);
  return ((await q.limit(1000)).data ?? []).map(r => ({ key: r.family!, name: r.family_name ?? r.family!, category: r.category, n_items: n(r.n_items), on_hand: n(r.on_hand), inbound_qty: n(r.inbound_qty), avg_6m: n(r.avg_6m), total_12m: n(r.total_12m), n_zero_stock: n(r.n_zero_stock), n_below_target: n(r.n_below_target) }));
}
/** 제품군 이름 목록 (입력칸 자동완성용) */
export async function fetchFamilyNames(sb: SB): Promise<string[]> {
  const { data } = await sb.schema("analytics").from("v_family_summary").select("family_name").limit(1000);
  return [...new Set((data ?? []).map(r => r.family_name).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}
export type PlanGroupRow = { key: string; name: string; categories: string; n_lines: number; qty: number; amount: number; n_stockout: number; n_flex: number };
/** 발주 계획의 제품군별 / 기종별 요약 */
export async function fetchPlanGroups(sb: SB, planId: string, by: "family" | "model"): Promise<PlanGroupRow[]> {
  const raw = by === "model"
    ? ((await sb.schema("app").rpc("fn_plan_model_summary", { p_plan_id: planId })).data ?? []).map(r => ({ key: r.model_base ?? "", name: r.codename ?? r.model_base ?? "", ...r }))
    : ((await sb.schema("analytics").from("v_order_plan_family").select("*").eq("plan_id", planId).limit(1000)).data ?? []).map(r => ({ key: r.family ?? "", name: r.family_name ?? r.family ?? "(제품군 없음)", ...r }));
  const m = new Map<string, PlanGroupRow & { cats: Set<string> }>();
  for (const r of raw) {
    const g = m.get(r.key) ?? { key: r.key, name: r.name, categories: "", cats: new Set<string>(), n_lines: 0, qty: 0, amount: 0, n_stockout: 0, n_flex: 0 };
    g.n_lines += n(r.n_lines); g.qty += n(r.qty); g.amount += n(r.amount); g.n_stockout += n(r.n_stockout); g.n_flex += n(r.n_flex); if (r.category) g.cats.add(r.category); m.set(r.key, g);
  }
  return [...m.values()].map(({ cats, ...g }) => ({ ...g, categories: [...cats].sort().map(catLabel).join(" · ") })).sort((a, b) => b.amount - a.amount || b.qty - a.qty);
}
