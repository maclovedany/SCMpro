"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
type R = { ok: true; data?: unknown } | { ok: false; error: string };
const MSG: Record<string, string> = { FORBIDDEN: "권한이 없습니다 (SCM 역할만)", UNKNOWN_ITEM: "품목 코드를 찾을 수 없습니다", BAD_QTY: "수량은 0 보다 커야 합니다", NEED_DATE_REQUIRED: "필요일을 입력하세요", REASON_REQUIRED: "사유를 입력하세요",
  NOT_APPROVED: "팀장 승인 후에 PO 를 연결할 수 있습니다", PO_ITEM_MISMATCH: "PO 의 품목이 긴급발주 품목과 다릅니다", UNKNOWN_PO: "PO 를 찾을 수 없습니다", NOT_FOUND: "긴급발주를 찾을 수 없습니다" };
const msg = (e: { message: string }) => MSG[Object.keys(MSG).find(k => e.message.includes(k)) ?? ""] ?? e.message;
const rev = () => { revalidatePath("/extra-demand"); revalidatePath("/dashboard"); revalidatePath("/approvals"); };
/** 긴급발주 요청 (R-OQ-44): 전 부서 → 팀장 승인 */
export async function requestUrgent(item: string, qty: number, needDate: string, reason: string): Promise<R> {
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_request_urgent", { p_item: item.trim(), p_qty: qty, p_need_date: needDate, p_reason: reason });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true, data };
}
/** 승인된 긴급발주에 PO 연결 (SCM) */
export async function linkUrgentPo(extraId: string, inboundId: number): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_link_urgent_inbound", { p_extra: extraId, p_inbound_id: inboundId });
  if (error) return { ok: false, error: msg(error) }; rev(); return { ok: true };
}
/** PO 진행 이벤트 기록 (R-SCH-33, SCM) */
export async function addInboundEvent(inboundId: number, stage: string, date: string, note: string): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_add_inbound_event", { p_inbound_id: inboundId, p_stage: stage, p_date: date || null as never, p_note: note });
  if (error) return { ok: false, error: msg(error) }; rev(); revalidatePath("/allocation"); return { ok: true };
}
