/** 기종(MC) OL · 실적 (R-FC-15 · R-FC-16, D-075 · D-077): 회사 파일과 같은 단위(Item Code × Family × 월). 실적/Sales OL = 실적 ÷ Sales OL.
 *  Family = 회사가 정한 보안용 약자, Item Code = 익명 코드, 구분 = DT · GC · PRT */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export type McOlRow = { model_key: string; model_base: string | null; biz: string | null; iot_code: string | null; ym: string; sales_ol: number | null; scm_ol: number | null; act: number | null; product_name: string; codename: string | null; predecessor?: string | null; successor?: string | null; sort_no?: number | null };
export type McCell = { sales_ol: number | null; scm_ol: number | null; act: number | null; ratio: number | null };
export type McLine = { key: string; iot: string | null; biz: string | null; product: string; codename: string | null; model_base: string | null; cells: McCell[]; total: McCell;
  predecessor: string | null; successor: string | null; sort_no: number; members: string[] };   // members = 전임 · 후속을 묶었을 때 들어 있는 Family (R-FC-16)
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
    const line = by.get(r.model_key) ?? { key: r.model_key, iot: r.iot_code, biz: r.biz, product: r.product_name, codename: r.codename, model_base: r.model_base, cells: months.map(() => ({ ...EMPTY })), total: { ...EMPTY },
      predecessor: r.predecessor ?? null, successor: r.successor ?? null, sort_no: r.sort_no ?? 0, members: [r.product_name] };
    const c = { sales_ol: num(r.sales_ol), scm_ol: num(r.scm_ol), act: num(r.act) };
    line.cells[idx.get(r.ym)!] = { ...c, ratio: ratioOf(c.act, c.sales_ol) };
    by.set(r.model_key, line);
  }
  const lines = [...by.values()].map(l => ({ ...l, total: l.cells.reduce(sumCell, { ...EMPTY }) }));
  lines.sort(byFileOrder);
  const cells = months.map((_, i) => lines.reduce((t, l) => sumCell(t, l.cells[i]), { ...EMPTY }));
  return { months, lines, total: { cells, total: cells.reduce(sumCell, { ...EMPTY }) }, activeProducts: lines.filter(l => (l.total.act ?? 0) > 0).length };
}
/** 소계 묶음 (R-FC-16): 회사 파일의 DT/GC SUB TOTAL · PRINTER SUB TOTAL + 구분별(DT · GC) 내역. sub = 내역 줄 */
export const MC_GROUPS = [{ key: "dtgc", label: "DT/GC 소계", biz: ["DT", "GC"], sub: false }, { key: "dt", label: "DT", biz: ["DT"], sub: true }, { key: "gc", label: "GC", biz: ["GC"], sub: true },
  { key: "printer", label: "PRINTER 소계", biz: ["PRT"], sub: false }] as const;
const groupNo = (b: string | null) => (b === "DT" || b === "GC" ? 0 : b === "PRT" ? 1 : 2);
/** 회사 파일 순서: 묶음(DT/GC → PRINTER) → 파일의 행 순서 → Item Code → 이름 */
const byFileOrder = (a: McLine, b: McLine) => groupNo(a.biz) - groupNo(b.biz) || a.sort_no - b.sort_no || (a.iot == null ? 1 : 0) - (b.iot == null ? 1 : 0) || (a.iot ?? "").localeCompare(b.iot ?? "") || a.product.localeCompare(b.product);
export type McSum = { cells: McCell[]; total: McCell; n: number };
const sumLines = (months: string[], ls: McLine[]): McSum => ({ cells: months.map((_, i) => ls.reduce((t, l) => sumCell(t, l.cells[i]), { ...EMPTY })), total: ls.reduce((t, l) => sumCell(t, l.total), { ...EMPTY }), n: ls.length });
/** 합계와 소계 — 받은 행(검색·필터가 적용된 행)만 더한다. 행이 없는 묶음은 내지 않는다 */
export function mcSummary(months: string[], lines: McLine[]): { total: McSum; groups: (McSum & { key: string; label: string; sub: boolean })[] } {
  return { total: sumLines(months, lines), groups: MC_GROUPS.map(g => ({ key: g.key, label: g.label, sub: g.sub, ...sumLines(months, lines.filter(l => (g.biz as readonly string[]).includes(l.biz ?? ""))) })).filter(g => g.n > 0) };
}
/** 전임 · 후속 묶기 (R-FC-16): 전임기와 후속기를 한 줄로 — 줄의 이름·코드는 마지막 후속기, 값은 달마다 더한다. 전임기가 표에 없으면 그대로 둔다 */
export function mcLineage(lines: McLine[]): McLine[] {
  const byKey = new Map(lines.map(l => [l.key, l]));
  const next = new Map<string, string>();                          // 전임 → 후속
  for (const l of lines) if (l.predecessor && byKey.has(l.predecessor)) next.set(l.predecessor, l.key);
  const root = (k: string) => { const seen = new Set<string>(); while (next.has(k) && !seen.has(k)) { seen.add(k); k = next.get(k)!; } return k; };
  const out = new Map<string, McLine>();
  for (const l of [...lines].sort((a, b) => (next.has(a.key) ? 0 : 1) - (next.has(b.key) ? 0 : 1))) {      // 전임기를 먼저 넣어 members 가 전임 → 후속 순이 되게
    const r = byKey.get(root(l.key))!; const cur = out.get(r.key);
    out.set(r.key, cur ? { ...cur, cells: cur.cells.map((c, i) => sumCell(c, l.cells[i])), total: sumCell(cur.total, l.total), members: [...cur.members, ...l.members] }
      : { ...r, cells: l.cells.map(c => ({ ...c })), total: { ...l.total }, members: [...l.members] });
  }
  return [...out.values()].sort(byFileOrder);
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
  const { data } = await sb.schema("analytics").from("v_mc_ol_act").select("model_key,model_base,biz,iot_code,ym,sales_ol,scm_ol,act,product_name,codename,predecessor,successor,sort_no").eq("fy", fy).order("ym").limit(1000);
  return (data ?? []).filter(r => r.model_key && r.ym).map(r => ({ ...r, model_key: r.model_key!, ym: r.ym!, product_name: r.product_name ?? r.model_key! }));
}
