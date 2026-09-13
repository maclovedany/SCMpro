import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export const SO_STATUS: Record<string, string> = { review_requested: "검토 요청(임시배정)", partial: "부분 임시배정", waiting: "배정 대기", confirmed: "수주 확정", rejected: "반려", cancelled: "취소", expired: "만료" };
export type SalesOrderRow = Database["app"]["Views"]["v_sales_order"]["Row"];
export async function fetchMyOrders(sb: SB, all: boolean, userId: string) {
  let q = sb.schema("app").from("v_sales_order").select("*").order("requested_at", { ascending: false }).limit(200);
  if (!all) q = q.eq("sales_rep", userId);
  const { data } = await q; return data ?? [];
}
export async function fetchAvailable(sb: SB, code: string) {
  const { data } = await sb.schema("app").from("v_available_stock").select("*").eq("item_code", code).maybeSingle(); return data;
}
export async function fetchQueue(sb: SB) {
  const { data } = await sb.schema("app").from("v_allocation_queue").select("*").order("item_code").order("queue_pos"); return data ?? [];
}
export async function fetchOpenInbound(sb: SB) {
  const { data } = await sb.schema("app").from("inbound").select("id,item_code,po_no,qty,planned_date,status,supplier:supplier_id(code,name)").neq("status", "received").order("planned_date").limit(100); return data ?? [];
}
export async function fetchPendingPriority(sb: SB) {
  const { data } = await sb.schema("app").from("approval").select("id,payload,reason,requested_at,status").eq("kind", "priority_alloc").eq("status", "pending"); return data ?? [];
}
export async function fetchTempOrders(sb: SB) {
  const { data } = await sb.schema("app").from("v_sales_order").select("*").in("status", ["review_requested", "partial", "waiting"]).order("item_code").order("priority").order("requested_at"); return data ?? [];
}

/** 재고 배정 개요 (D-036): RPC fn_allocation_overview 한 번 */
export type AllocationOverview = {
  alloc_mix: { temp: number; firm: number; hold: number; waiting: number };
  queue_top: { item_code: string; description: string | null; shortage: number; n_orders: number; available: number | null }[];
  expiring: { d: string; n: number; qty: number }[];
  inbound_plan: { ym: string; supplier: string; qty: number; n: number }[];
  status_mix: { status: string; n: number }[];
  daily_requests: { d: string; n: number }[];
};
export async function fetchAllocationOverview(sb: SB): Promise<AllocationOverview> {
  const { data, error } = await sb.schema("app").rpc("fn_allocation_overview");
  if (error) throw error;
  const d = (data ?? {}) as Partial<AllocationOverview>;
  return { alloc_mix: d.alloc_mix ?? { temp: 0, firm: 0, hold: 0, waiting: 0 }, queue_top: d.queue_top ?? [], expiring: d.expiring ?? [], inbound_plan: d.inbound_plan ?? [], status_mix: d.status_mix ?? [], daily_requests: d.daily_requests ?? [] };
}
/** 개요 → 차트 데이터 (순수 함수). today = 'YYYY-MM-DD' (만료 예정 축 30일 0 채움) */
export function allocationCharts(o: AllocationOverview, today: string) {
  const m = o.alloc_mix;
  const mix = [{ name: "임시배정", value: Number(m.temp) }, { name: "확정배정", value: Number(m.firm) }, { name: "승인대기 확보", value: Number(m.hold) }, { name: "배정 대기(부족)", value: Number(m.waiting) }];
  const mixTotal = mix.reduce((a, x) => a + x.value, 0);
  const days = Array.from({ length: 31 }, (_, i) => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const expQty = days.map(d => Number(o.expiring.find(e => e.d === d)?.qty ?? 0));
  const expN = o.expiring.reduce((a, e) => a + Number(e.n), 0), exp7 = o.expiring.filter(e => e.d <= days[7]).reduce((a, e) => a + Number(e.n), 0);
  const months = Array.from(new Set(o.inbound_plan.map(x => x.ym))).sort(); const sups = Array.from(new Set(o.inbound_plan.map(x => x.supplier))).sort();
  const inbTotal = o.inbound_plan.reduce((a, x) => a + Number(x.qty), 0), inbFirst = months[0] ? o.inbound_plan.filter(x => x.ym === months[0]).reduce((a, x) => a + Number(x.qty), 0) : 0;
  const top = o.queue_top[0];
  return {
    mix: { data: mix, insight: mixTotal ? `배정 대기(부족) ${Number(m.waiting).toLocaleString("ko-KR")}개가 전체의 ${Math.round(100 * Number(m.waiting) / mixTotal)}% — 입고 시 순번대로 자동 배정` : "활성 배정 없음" },
    queue: { labels: o.queue_top.map(q => q.item_code), values: o.queue_top.map(q => Number(q.shortage)), insight: top ? `${top.item_code} 부족 ${Number(top.shortage).toLocaleString("ko-KR")} (주문 ${top.n_orders}건, 가용 ${Number(top.available ?? 0).toLocaleString("ko-KR")})${Number(top.available ?? 0) > 0 ? " — 지금 수동 배정 가능" : ""}` : "대기 주문 없음" },
    expiring: { x: days.map(d => d.slice(5)), values: expQty, insight: expN ? `30일 내 만료 ${expN}건 · 7일 내 ${exp7}건 — 만료 전 수주 확정 필요 (R-AL-02)` : "30일 내 만료 예정 임시배정 없음" },
    inbound: { categories: months, series: sups.map(s => ({ name: s, data: months.map(mm => Number(o.inbound_plan.find(x => x.ym === mm && x.supplier === s)?.qty ?? 0)) })), insight: months[0] ? `${months[0]} 입고 예정 ${inbFirst.toLocaleString("ko-KR")}개 (전체 ${inbTotal.toLocaleString("ko-KR")}) — 입고 완료 처리 시 auto 품목 자동배정` : "입고 예정 없음" },
    status: { data: o.status_mix.map(s => ({ name: SO_STATUS[s.status] ?? s.status, value: Number(s.n) })) },
    daily: { x: Array.from({ length: 30 }, (_, i) => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 29 + i); return d.toISOString().slice(0, 10); }).map(d => ({ d, n: Number(o.daily_requests.find(x => x.d === d)?.n ?? 0) })) },
  };
}
export type AllocationCharts = ReturnType<typeof allocationCharts>;
