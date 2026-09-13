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
