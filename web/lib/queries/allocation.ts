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
