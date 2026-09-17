"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
type R = { ok: true; data?: unknown } | { ok: false; error: string };
export async function submitDemand(ym: string, dept: string, note: string): Promise<R> {
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").rpc("fn_submit_demand", { p_ym: ym, p_dept: dept, p_note: note });
  if (error) return { ok: false, error: error.message.includes("FORBIDDEN") ? "본인 부서만 제출할 수 있습니다" : error.message };
  revalidatePath("/schedule"); return { ok: true };
}
export async function runFullTick(): Promise<R> {
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_tick");
  if (error) return { ok: false, error: error.message }; revalidatePath("/schedule"); revalidatePath("/notifications"); return { ok: true, data };
}
export async function updateSailingRule(supplierId: number, weekday: number, weeks: number[]): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (weekday < 1 || weekday > 7 || weeks.length === 0) return { ok: false, error: "요일(1~7)과 주차를 지정하세요" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("supplier").update({ sailing_rule: { weekday, weeks } as never, updated_by: p.user_id, updated_at: new Date().toISOString() }).eq("id", supplierId);
  if (error) return { ok: false, error: error.message }; revalidatePath("/schedule"); revalidatePath("/admin/suppliers"); return { ok: true };
}
/** 수요자료 상세 라인 저장 (R-SCH-32): 고객사 × 품목 × 수량. qty 0 이면 삭제 */
export async function saveDemandLines(ym: string, dept: string, lines: { customer_code: string; item_code: string; qty: number; note?: string }[]): Promise<R> {
  if (!lines.length) return { ok: false, error: "저장할 라인이 없습니다" };
  const sb = await createServerSupabase(); const { data, error } = await sb.schema("app").rpc("fn_save_demand_lines", { p_ym: ym, p_dept: dept, p_lines: lines as never });
  if (error) { const m = error.message; return { ok: false, error: m.includes("FORBIDDEN") ? "본인 부서만 입력할 수 있습니다" : m.includes("UNKNOWN_ITEM") ? "품목 코드를 찾을 수 없습니다" : m.includes("UNKNOWN_CUSTOMER") ? "고객사를 찾을 수 없습니다" : m }; }
  revalidatePath("/schedule"); revalidatePath("/sales-orders/customers"); revalidatePath("/dashboard"); return { ok: true, data };
}
