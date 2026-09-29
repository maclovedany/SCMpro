/** 기종 OL · 실적 (R-FC-15, D-075): 원본 파일과 같은 단위(IOT × Product × 월). Sales Act ratio = 실적 ÷ Sales OL */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export type McOlRow = { model_key: string; model_base: string | null; biz: string | null; iot_code: string | null; ym: string; sales_ol: number | null; scm_ol: number | null; act: number | null; product_name: string; codename: string | null };
export type McCell = { sales_ol: number | null; scm_ol: number | null; act: number | null; ratio: number | null };
export type McLine = { key: string; iot: string | null; biz: string | null; product: string; codename: string | null; model_base: string | null; cells: McCell[]; total: McCell };
export type McPivot = { months: string[]; lines: McLine[]; total: { cells: McCell[]; total: McCell }; activeProducts: number };
export const BIZ_ORDER = ["DT", "GC", "PRT"] as const;
/** 회계연도 4월 시작 (R-FC-08) */
export const fyOf = (ym: string) => (Number(ym.slice(5, 7)) >= 4 ? Number(ym.slice(0, 4)) : Number(ym.slice(0, 4)) - 1);
export const fyLabel = (fy: number) => `FY${String(fy).slice(2)}`;
/** Sales OL 이 0 이거나 없으면 비율을 내지 않는다 (원본 파일은 0 으로 표시) */
export const ratioOf = (act: number | null, salesOl: number | null): number | null => (act == null || salesOl == null || salesOl === 0 ? null : act / salesOl);
const EMPTY: McCell = { sales_ol: null, scm_ol: null, act: null, ratio: null };
const add = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);
const sumCell = (a: McCell, b: McCell): McCell => { const s = { sales_ol: add(a.sales_ol, b.sales_ol), scm_ol: add(a.scm_ol, b.scm_ol), act: add(a.act, b.act) }; return { ...s, ratio: ratioOf(s.act, s.sales_ol) }; };
const num = (v: number | string | null) => (v == null ? null : Number(v));
export function mcPivot(rows: McOlRow[], biz?: string): McPivot {
  const use = rows.filter(r => !biz || r.biz === biz);
  const months = [...new Set(use.map(r => r.ym))].sort();
  const idx = new Map(months.map((m, i) => [m, i]));
  const by = new Map<string, McLine>();
  for (const r of use) {
    const line = by.get(r.model_key) ?? { key: r.model_key, iot: r.iot_code, biz: r.biz, product: r.product_name, codename: r.codename, model_base: r.model_base, cells: months.map(() => ({ ...EMPTY })), total: { ...EMPTY } };
    const c = { sales_ol: num(r.sales_ol), scm_ol: num(r.scm_ol), act: num(r.act) };
    line.cells[idx.get(r.ym)!] = { ...c, ratio: ratioOf(c.act, c.sales_ol) };
    by.set(r.model_key, line);
  }
  const lines = [...by.values()].map(l => ({ ...l, total: l.cells.reduce(sumCell, { ...EMPTY }) }));
  const ord = (b: string | null) => { const i = (BIZ_ORDER as readonly string[]).indexOf(b ?? ""); return i < 0 ? 9 : i; };
  lines.sort((a, b) => ord(a.biz) - ord(b.biz) || (a.iot == null ? 1 : 0) - (b.iot == null ? 1 : 0) || (a.iot ?? "").localeCompare(b.iot ?? "") || a.product.localeCompare(b.product));
  const cells = months.map((_, i) => lines.reduce((t, l) => sumCell(t, l.cells[i]), { ...EMPTY }));
  return { months, lines, total: { cells, total: cells.reduce(sumCell, { ...EMPTY }) }, activeProducts: lines.filter(l => (l.total.act ?? 0) > 0).length };
}
/** 원본 파일의 소계 묶음: DT/GC SUB TOTAL · PRINTER SUB TOTAL */
export const MC_GROUPS = [{ key: "dtgc", label: "DT/GC 소계", biz: ["DT", "GC"] }, { key: "printer", label: "PRINTER 소계", biz: ["PRT"] }] as const;
export type McSum = { cells: McCell[]; total: McCell; n: number };
const sumLines = (months: string[], ls: McLine[]): McSum => ({ cells: months.map((_, i) => ls.reduce((t, l) => sumCell(t, l.cells[i]), { ...EMPTY })), total: ls.reduce((t, l) => sumCell(t, l.total), { ...EMPTY }), n: ls.length });
/** 합계와 소계 — 받은 행(검색·필터가 적용된 행)만 더한다. 행이 없는 묶음은 내지 않는다 */
export function mcSummary(months: string[], lines: McLine[]): { total: McSum; groups: (McSum & { key: string; label: string })[] } {
  return { total: sumLines(months, lines), groups: MC_GROUPS.map(g => ({ key: g.key, label: g.label, ...sumLines(months, lines.filter(l => (g.biz as readonly string[]).includes(l.biz ?? ""))) })).filter(g => g.n > 0) };
}
/** 데이터가 있는 회계연도 목록 (최신 먼저) */
export async function fetchMcFys(sb: SB): Promise<number[]> {
  const [lo, hi] = await Promise.all([
    sb.schema("analytics").from("v_mc_ol_act").select("fy").order("fy", { ascending: true }).limit(1).maybeSingle(),
    sb.schema("analytics").from("v_mc_ol_act").select("fy").order("fy", { ascending: false }).limit(1).maybeSingle()]);
  if (lo.data?.fy == null || hi.data?.fy == null) return [];
  return Array.from({ length: hi.data.fy - lo.data.fy + 1 }, (_, i) => hi.data!.fy! - i);
}
/** 한 회계연도 (FY 당 900행 안팎 — 1,000행 제한 안) */
export async function fetchMcOlAct(sb: SB, fy: number): Promise<McOlRow[]> {
  const { data } = await sb.schema("analytics").from("v_mc_ol_act").select("model_key,model_base,biz,iot_code,ym,sales_ol,scm_ol,act,product_name,codename").eq("fy", fy).order("ym").limit(1000);
  return (data ?? []).filter(r => r.model_key && r.ym).map(r => ({ ...r, model_key: r.model_key!, ym: r.ym!, product_name: r.product_name ?? r.model_key! }));
}
