/** AI Agent 의 기종(MC) 도구용 계산 (R-AI-05, D-080). 자료 = analytics.v_mc_ol_act · v_mc_item — Family 는 회사 약자, Item Code 는 익명 코드 */
import { mcPivot, mcSummary, type McOlRow, type McCell } from "@/lib/queries/mcPlan";
import type { AliasMap } from "@/lib/names";
const cell = (c: McCell) => ({ sales_ol: c.sales_ol, scm_ol: c.scm_ol, act: c.act, act_vs_sales_ol: c.ratio });
/** 기간 합계 · 묶음별 소계(DT/GC — DT · GC, PRINTER) · 실적 큰 순 Family */
export function mcTotalsOf(rows: McOlRow[], top = 10, biz?: string) {
  const p = mcPivot(rows, biz); const s = mcSummary(p.months, p.lines);
  return { months: p.months, total: { families: s.total.n, ...cell(s.total.total) },
    groups: s.groups.map(g => ({ group: g.label, families: g.n, ...cell(g.total) })),
    top: [...p.lines].sort((a, b) => (b.total.act ?? 0) - (a.total.act ?? 0)).slice(0, Math.max(1, Math.min(30, top)))
      .map(l => ({ family: l.product, biz: l.biz, item_code: l.iot, machine: l.codename, predecessor: l.predecessor, successor: l.successor, ...cell(l.total) })) };
}
/** Family 하나의 월별 값과 합계. 이름은 대소문자를 가리지 않는다 */
export function mcFamilyOf(rows: McOlRow[], family: string) {
  const k = family.trim().toLowerCase();
  const p = mcPivot(rows.filter(r => r.product_name.toLowerCase() === k));
  const l = p.lines[0]; if (!l) return null;
  return { family: l.product, biz: l.biz, item_code: l.iot, machine: l.codename, predecessor: l.predecessor, successor: l.successor,
    months: p.months.map((ym, i) => ({ ym, ...cell(l.cells[i]) })), total: cell(l.total) };
}
/** PostgREST 의 or(…) 안에 넣는 ilike 값: 쉼표·괄호가 있어도 되게 따옴표로 감싼다 */
export const likeValue = (v: string) => `"%${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`;
/** 표시 이름(실제 제품군 이름)에 q 가 들어 있는 제품군의 저장된 이름들 — 품목을 제품군 이름으로 찾을 때 */
export function familiesLike(m: AliasMap, q: string, limit = 30): string[] {
  const k = q.trim().toLowerCase(); if (!k) return [];
  const out: string[] = [];
  for (const [key, real] of m.exact) { if (key.startsWith("family\u0000") && real.toLowerCase().includes(k)) out.push(key.slice("family\u0000".length)); if (out.length >= limit) break; }
  return out;
}
