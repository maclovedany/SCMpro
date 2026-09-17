"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
type R = { ok: true; data?: unknown } | { ok: false; error: string };
const MSG: Record<string, string> = { ITEM_QUOTA_EXCEEDED: "품목 강제배정 한도를 넘습니다 (관리자 설정: 현재고 대비 %)", CUSTOMER_NEED_EXCEEDED: "이 고객사가 제출한 필요 수량을 넘습니다", CUSTOMER_REQUIRED: "고객코드가 없는 주문은 강제배정할 수 없습니다", UNKNOWN_CUSTOMER: "고객사를 찾을 수 없습니다", BAD_QTY: "수량은 0 보다 커야 합니다", FORBIDDEN: "권한이 없습니다", UNKNOWN_ITEM: "품목 코드를 찾을 수 없습니다", REASON_REQUIRED: "사유를 입력하세요", BAD_STATUS: "현재 상태에서는 처리할 수 없습니다", ALREADY_CLOSED: "이미 종료된 주문입니다", INSUFFICIENT: "가용재고가 부족합니다", EXCEEDS_SHORTAGE: "부족 수량을 초과합니다", ALREADY_RECEIVED: "이미 입고 처리됨", NOT_FOUND: "찾을 수 없습니다" };
const msg = (e: { message: string }) => { const k = Object.keys(MSG).find(k => e.message.includes(k)); return k ? `${MSG[k]}${e.message.includes("available") ? ` (${e.message.split("available")[1]?.trim()})` : ""}` : e.message; };
const rev = () => { revalidatePath("/sales-orders"); revalidatePath("/sales-orders/customers"); revalidatePath("/allocation/force"); revalidatePath("/dashboard"); revalidatePath("/allocation"); revalidatePath("/allocation/priority"); revalidatePath("/approvals"); revalidatePath("/items"); };
export async function createSalesOrder(item: string, qty: number, customer: string, mode: "partial" | "wait", prev?: string, customerCode?: string): Promise<R> {
  if (!(await getProfile())) return { ok: false, error: "로그인 필요" };
  if (!(qty > 0)) return { ok: false, error: "수량은 0 보다 커야 합니다" };
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_create_sales_order", { p_item: item.trim(), p_qty: qty, p_customer: customer, p_mode: mode, p_prev: prev ?? null as never, p_customer_code: customerCode || null as never });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true, data };
}
export async function confirmSalesOrder(id: string): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_confirm_sales_order", { p_id: id });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true };
}
export async function cancelSalesOrder(id: string, reason: string): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_cancel_sales_order", { p_id: id, p_reason: reason });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true };
}
export async function receiveInbound(id: number, actual: string): Promise<R> {
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_receive_inbound", { p_inbound_id: id, p_actual: actual });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true, data };
}
export async function manualAllocate(orderId: string, qty: number, reason: string): Promise<R> {
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_manual_allocate", { p_order: orderId, p_qty: qty, p_reason: reason });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true, data };
}
export async function setPriority(orderId: string, priority: number, reason: string): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_set_priority", { p_order: orderId, p_priority: priority, p_reason: reason });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true };
}
export async function runTick(): Promise<R> {
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_allocation_tick");
  if (error) return { ok: false, error: msg(error) }; rev(); revalidatePath("/notifications"); return { ok: true, data };
}
/** 강제배정 (R-AL-53/54): 사업강화부·SCM팀장·관리자. 한도 검사는 RPC 가 한다 */
export async function forceAllocate(orderId: string, qty: number, reason: string): Promise<R> {
  if (!(qty > 0)) return { ok: false, error: "수량은 0 보다 커야 합니다" };
  if (!reason.trim()) return { ok: false, error: "사유를 입력하세요" };
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_force_allocate", { p_order: orderId, p_qty: qty, p_reason: reason });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true, data };
}
