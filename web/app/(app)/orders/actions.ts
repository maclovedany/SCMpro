"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload, canWriteMaster } from "@/lib/auth/roles";
import { computePlan, parseSettings, type ItemInput } from "@/lib/order/calc";
type R = { ok: true; id?: string; data?: unknown } | { ok: false; error: string };
const MSG: Record<string, string> = { FORBIDDEN: "권한이 없습니다", BLOCKED_LINES: "목표 DoS 미설정 품목이 있어 확정할 수 없습니다 (R-OQ-03)", PLAN_NOT_DRAFT: "초안 상태에서만 수정할 수 있습니다", REASON_REQUIRED: "사유를 입력하세요", ORDER_NO_REQUIRED: "수주 확정은 주문번호가 필수입니다", BULKDEAL_FIELDS_REQUIRED: "Bulkdeal 은 고객·기종·사유가 필수입니다", UNKNOWN_ITEM: "품목 코드를 찾을 수 없습니다", ALREADY_PENDING: "이미 승인 대기 중입니다" };
const msg = (e: { message: string }) => { const k = Object.keys(MSG).find(k => e.message.includes(k)); return k ? MSG[k] : e.message; };
/** 계획 생성: fn_order_inputs → calc.ts → fn_save_order_plan (R-OQ 산출) */
export async function generatePlan(planYm: string, note?: string): Promise<R> {
  const p = await getProfile(); if (!p || !canUpload(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!/^\d{4}-\d{2}$/.test(planYm)) return { ok: false, error: "발주월 형식 YYYY-MM" };
  // authenticated 역할은 statement_timeout 8s → 대량 저장은 service role + 청크 (호출자는 p_user 로 전달, 역할 검사는 함수 안에서)
  const admin = createAdminClient();
  // PostgREST statement_timeout 8s 안에 끝나도록 카테고리별로 나눠 조회 (D-022)
  type Inp = { data_last_ym: string | null; settings: Record<string, unknown>; items: ItemInput[] };
  const parts: Inp[] = [];
  for (const cat of ["PART", "SUPPLY", "OPTION"]) {
    const { data, error } = await admin.schema("app").rpc("fn_order_inputs", { p_plan_ym: planYm, p_category: cat });
    if (error) return { ok: false, error: `입력 조회 실패 (${cat}): ${msg(error)}` };
    parts.push(data as unknown as Inp);
  }
  const inp: Inp = { data_last_ym: parts[0].data_last_ym, settings: parts[0].settings, items: parts.flatMap(p => p.items) };
  if (!inp.data_last_ym) return { ok: false, error: "프로덕션 예측이 없습니다 — engine forecast run 먼저" };
  const lines = computePlan(inp.items, planYm, inp.data_last_ym, parseSettings(inp.settings));
  const { data: id, error: e2 } = await admin.schema("app").rpc("fn_save_order_plan", { p_plan_ym: planYm, p_note: note ?? null as never, p_user: p.user_id });
  if (e2) return { ok: false, error: msg(e2) };
  const CHUNK = 500;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const { error: e3 } = await admin.schema("app").rpc("fn_append_plan_lines", { p_plan_id: id as string, p_lines: lines.slice(i, i + CHUNK) as never });
    if (e3) return { ok: false, error: `라인 저장 실패 (${i}): ${e3.message}` };
  }
  await admin.schema("app").rpc("fn_finalize_order_plan", { p_plan_id: id as string });
  revalidatePath("/orders"); revalidatePath("/dashboard"); return { ok: true, id: id as string };
}
export async function overrideLine(lineId: number, qty: number | null, reason: string): Promise<R> {
  const p = await getProfile(); if (!p || !canUpload(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").rpc("fn_override_line", { p_line_id: lineId, p_qty: qty as never, p_reason: reason });
  if (error) return { ok: false, error: msg(error) };
  revalidatePath("/orders"); return { ok: true };
}
export async function confirmPlan(planId: string, reason: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "품목담당자만 확정할 수 있습니다" };
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_confirm_order_plan", { p_plan_id: planId, p_reason: reason });
  if (error) return { ok: false, error: msg(error) };
  revalidatePath("/orders"); revalidatePath("/approvals"); return { ok: true, id: data as string };
}
export async function addExtraDemand(input: { kind: string; item_code: string; need_ym: string; qty: number; order_no?: string; customer?: string; model?: string; reason?: string }): Promise<R> {
  const p = await getProfile(); if (!p) return { ok: false, error: "로그인 필요" };
  if (!(input.qty > 0)) return { ok: false, error: "수량은 0 보다 커야 합니다" };
  if (!/^\d{4}-\d{2}$/.test(input.need_ym)) return { ok: false, error: "필요월 형식 YYYY-MM" };
  const nz = (v?: string) => (v && v.trim() ? v.trim() : null);   // 빈 문자열은 NULL 로 (표시·필수 검사 정합)
  const sb = await createServerSupabase();
  const { data, error } = await sb.schema("app").rpc("fn_add_extra_demand", { p_kind: input.kind, p_item: input.item_code.trim(), p_need_ym: input.need_ym, p_qty: input.qty,
    p_order_no: nz(input.order_no) as never, p_customer: nz(input.customer) as never, p_model: nz(input.model) as never, p_reason: nz(input.reason) as never });
  if (error) return { ok: false, error: msg(error) };
  revalidatePath("/extra-demand"); const d = data as { id: string; bulkdeal_overlap: unknown[] }; return { ok: true, id: d.id, data: d };
}
