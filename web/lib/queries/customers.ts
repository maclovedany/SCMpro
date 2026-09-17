import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { fmtInt, fmtPct } from "@/lib/format";
type SB = SupabaseClient<Database>;
/** 고객사별 배정현황 (R-AL-52, D-058). 화면은 analytics 뷰만 읽는다 (D-056) */
export type CustAllocRow = { customer_code: string; customer_name: string | null; segment: string | null; is_strategic: boolean; item_code: string; description: string | null; item_type: string | null;
  need_qty: number; has_demand_line: boolean; depts: string | null; order_qty: number; n_orders: number; temp_qty: number; firm_qty: number; hold_qty: number; forced_qty: number;
  allocated_qty: number; shortage_qty: number; fill_rate: number | null; available: number; is_dummy: boolean };
const n = (v: unknown) => Number(v ?? 0);
export async function fetchCustomerAllocation(sb: SB, f: { customer?: string; shortOnly?: boolean } = {}): Promise<CustAllocRow[]> {
  let q = sb.schema("analytics").from("v_customer_allocation").select("*").order("customer_name").order("item_code").limit(2000);
  if (f.customer) q = q.eq("customer_code", f.customer);
  if (f.shortOnly) q = q.gt("shortage_qty", 0);
  const { data, error } = await q; if (error) throw error;
  return (data ?? []).map(r => ({ ...r, customer_code: r.customer_code ?? "", item_code: r.item_code ?? "", is_strategic: !!r.is_strategic, has_demand_line: !!r.has_demand_line, is_dummy: !!r.is_dummy,
    need_qty: n(r.need_qty), order_qty: n(r.order_qty), n_orders: n(r.n_orders), temp_qty: n(r.temp_qty), firm_qty: n(r.firm_qty), hold_qty: n(r.hold_qty), forced_qty: n(r.forced_qty),
    allocated_qty: n(r.allocated_qty), shortage_qty: n(r.shortage_qty), fill_rate: r.fill_rate == null ? null : Number(r.fill_rate), available: n(r.available) }));
}
export type CustSummary = ReturnType<typeof customerAllocSummary>;
/** 요약 (순수 함수). 배정은 필요를 넘지 않게 잘라 충족률이 100% 를 넘지 않는다 */
export function customerAllocSummary(rows: CustAllocRow[]) {
  const byC = new Map<string, { code: string; name: string; strategic: boolean; need: number; allocated: number; shortage: number }>();
  const byI = new Map<string, { item_code: string; description: string | null; shortage: number }>();
  for (const r of rows) {
    const c = byC.get(r.customer_code) ?? { code: r.customer_code, name: r.customer_name ?? r.customer_code, strategic: r.is_strategic, need: 0, allocated: 0, shortage: 0 };
    c.need += r.need_qty; c.allocated += Math.min(r.allocated_qty, r.need_qty); c.shortage += r.shortage_qty; byC.set(r.customer_code, c);
    const i = byI.get(r.item_code) ?? { item_code: r.item_code, description: r.description, shortage: 0 }; i.shortage += r.shortage_qty; byI.set(r.item_code, i);
  }
  const byCustomer = [...byC.values()].map(c => ({ ...c, fill: c.need > 0 ? c.allocated / c.need : null })).sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name, "ko"));
  const need = byCustomer.reduce((a, c) => a + c.need, 0), allocated = byCustomer.reduce((a, c) => a + c.allocated, 0), shortage = byCustomer.reduce((a, c) => a + c.shortage, 0);
  return { customers: byCustomer.length, need, allocated, shortage, fillRate: need > 0 ? allocated / need : null, shortCustomers: byCustomer.filter(c => c.shortage > 0).length, byCustomer,
    topItems: [...byI.values()].filter(i => i.shortage > 0).sort((a, b) => b.shortage - a.shortage || a.item_code.localeCompare(b.item_code)).slice(0, 10) };
}
export function customerAllocCharts(s: CustSummary) {
  const top = s.byCustomer.slice(0, 12); const worst = top[0];
  return {
    bars: { categories: top.map(c => c.name), series: [{ name: "배정", data: top.map(c => c.allocated) }, { name: "부족", data: top.map(c => c.shortage) }],
      insight: worst && worst.shortage > 0 ? `${worst.name} 이(가) 필요 ${fmtInt(worst.need)} 중 ${fmtInt(worst.shortage)} 부족 (충족률 ${fmtPct(worst.fill)}) — 가장 큼` : s.customers ? "모든 고객사가 필요 수량만큼 배정되었습니다" : "수요자료·주문이 없습니다" },
    items: { labels: s.topItems.map(i => `${i.item_code} ${i.description ?? ""}`.trim()), values: s.topItems.map(i => i.shortage), codes: s.topItems.map(i => i.item_code),
      insight: s.topItems[0] ? `${s.topItems[0].item_code} 부족 ${fmtInt(s.topItems[0].shortage)} — 입고·강제배정 우선 검토` : "부족 품목 없음" },
  };
}

/** 강제배정 대상 (R-AL-53) */
export type ForcePoolRow = { order_id: string; order_no: string; item_code: string; description: string | null; item_type: string | null; customer_code: string; customer_name: string | null; is_strategic: boolean;
  qty: number; status: string; priority: number; requested_at: string; is_dummy: boolean; shortage: number; order_forced_qty: number; available: number; on_hand: number;
  customer_need: number | null; depts: string | null; customer_forced_qty: number; item_forced_qty: number; item_quota: number; quota_pct: number };
export async function fetchForcePool(sb: SB): Promise<ForcePoolRow[]> {
  const { data, error } = await sb.schema("analytics").from("v_force_alloc_pool").select("*").order("item_code").order("priority").order("requested_at").limit(500); if (error) throw error;
  return (data ?? []).map(r => ({ ...r, order_id: r.order_id ?? "", order_no: r.order_no ?? "", item_code: r.item_code ?? "", customer_code: r.customer_code ?? "", status: r.status ?? "", requested_at: r.requested_at ?? "",
    is_strategic: !!r.is_strategic, is_dummy: !!r.is_dummy, qty: n(r.qty), priority: n(r.priority), shortage: n(r.shortage), order_forced_qty: n(r.order_forced_qty), available: n(r.available), on_hand: n(r.on_hand),
    customer_need: r.customer_need == null ? null : Number(r.customer_need), customer_forced_qty: n(r.customer_forced_qty), item_forced_qty: n(r.item_forced_qty), item_quota: n(r.item_quota), quota_pct: n(r.quota_pct) }));
}
/** 이 주문에 지금 강제배정할 수 있는 최대 수량 = min(부족, 가용, 품목 한도 잔여, 고객사 필요 잔여). RPC 의 검사와 같은 식 */
export function maxForceQty(r: ForcePoolRow): number {
  const cust = r.customer_need == null ? Infinity : r.customer_need - r.customer_forced_qty;
  return Math.max(0, Math.floor(Math.min(r.shortage, r.available, r.item_quota - r.item_forced_qty, cust)));
}
export function forcePoolSummary(rows: ForcePoolRow[]) {
  const items = new Map<string, { item_code: string; description: string | null; quota: number; used: number; remaining: number; available: number; orders: number }>();
  for (const r of rows) { const i = items.get(r.item_code) ?? { item_code: r.item_code, description: r.description, quota: r.item_quota, used: r.item_forced_qty, remaining: Math.max(0, r.item_quota - r.item_forced_qty), available: r.available, orders: 0 }; i.orders += 1; items.set(r.item_code, i); }
  return { orders: rows.length, eligible: rows.filter(r => maxForceQty(r) > 0).length, pct: rows[0]?.quota_pct ?? null, items: [...items.values()].sort((a, b) => a.item_code.localeCompare(b.item_code)) };
}

export type CustomerRow = { code: string; name: string; segment: string | null; is_strategic: boolean; is_dummy: boolean; sales_rep_name: string | null };
export async function fetchCustomers(sb: SB): Promise<CustomerRow[]> {
  const { data } = await sb.schema("analytics").from("v_customer").select("code,name,segment,is_strategic,is_dummy,sales_rep_name").order("code");
  return (data ?? []).map(c => ({ code: c.code ?? "", name: c.name ?? "", segment: c.segment, is_strategic: !!c.is_strategic, is_dummy: !!c.is_dummy, sales_rep_name: c.sales_rep_name }));
}
export type DemandLineRow = { id: number; ym: string; dept: string; customer_code: string; customer_name: string | null; item_code: string; description: string | null; qty: number; note: string | null; is_dummy: boolean };
export async function fetchDemandLines(sb: SB, ym: string): Promise<DemandLineRow[]> {
  const { data } = await sb.schema("analytics").from("v_demand_line").select("id,ym,dept,customer_code,customer_name,item_code,description,qty,note,is_dummy").eq("ym", ym).order("dept").order("customer_code").order("item_code").limit(1000);
  return (data ?? []).map(d => ({ id: n(d.id), ym: d.ym ?? "", dept: d.dept ?? "", customer_code: d.customer_code ?? "", customer_name: d.customer_name, item_code: d.item_code ?? "", description: d.description, qty: n(d.qty), note: d.note, is_dummy: !!d.is_dummy }));
}
/** 품목코드 → 품명 (R-UI-15). 데이터에 품명이 없는 표에서 코드 옆에 붙인다 */
export async function fetchItemNames(sb: SB, codes: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(codes.filter((c): c is string => !!c))); if (!uniq.length) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await sb.schema("analytics").from("v_item_name").select("item_code,description").in("item_code", uniq.slice(i, i + 200));
    for (const r of data ?? []) if (r.item_code && r.description) out[r.item_code] = r.description;
  }
  return out;
}
export type GroupStockRow = { group_code: string; group_name: string; owner_dept: string | null; is_dummy: boolean; item_code: string; description: string | null; on_hand: number; available: number; dos_days: number | null };
export async function fetchGroupStock(sb: SB): Promise<GroupStockRow[]> {
  const { data } = await sb.schema("analytics").from("v_group_stock").select("group_code,group_name,owner_dept,is_dummy,item_code,description,on_hand,available,dos_days").order("group_code").order("item_code");
  return (data ?? []).map(g => ({ group_code: g.group_code ?? "", group_name: g.group_name ?? "", owner_dept: g.owner_dept, is_dummy: !!g.is_dummy, item_code: g.item_code ?? "", description: g.description, on_hand: n(g.on_hand), available: n(g.available), dos_days: g.dos_days == null ? null : Number(g.dos_days) }));
}
