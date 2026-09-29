/** MC 품목 목록 (R-FC-16, D-077): 기종(MC) 제품군마다 한 줄 — 구분(DT · GC · PRT) · 전임/후속 · 최근 실적 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { MC_BIZ } from "@/lib/design/category";
export type McItem = { family: string; biz: string | null; item_code: string | null; model_base: string | null; codename: string | null; predecessor: string | null; successor: string | null; has_alias: boolean;
  last_ym: string | null; act_12m: number; act_avg_6m: number; last_sales_ol: number | null; last_scm_ol: number | null; last_act: number | null; last_act_ym: string | null; sort_no: number };
const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));
export async function fetchMcItems(sb: SupabaseClient<Database>): Promise<McItem[]> {
  const { data } = await sb.schema("analytics").from("v_mc_item").select("*").order("sort_no").limit(1000);
  return (data ?? []).filter(r => r.family_key).map(r => ({ family: r.family_key!, biz: r.biz, item_code: r.item_code, model_base: r.model_base, codename: r.codename, predecessor: r.predecessor, successor: r.successor, has_alias: r.has_alias ?? true,
    last_ym: r.last_ym, act_12m: n(r.act_12m) ?? 0, act_avg_6m: n(r.act_avg_6m) ?? 0, last_sales_ol: n(r.last_sales_ol), last_scm_ol: n(r.last_scm_ol), last_act: n(r.last_act), last_act_ym: r.last_act_ym, sort_no: r.sort_no ?? 0 }));
}
/** 구분별 집계 (DT · GC · PRT 순, 구분 없는 것은 "미분류") */
export function mcByBiz(items: McItem[]): { biz: string; n: number; act_12m: number; active: number }[] {
  const keys = [...MC_BIZ, ...(items.some(i => !i.biz) ? ["미분류"] : [])];
  return keys.map(b => { const g = items.filter(i => (i.biz ?? "미분류") === b); return { biz: b, n: g.length, act_12m: g.reduce((a, i) => a + i.act_12m, 0), active: g.filter(i => i.act_12m > 0).length }; });
}
