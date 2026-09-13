"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { validateItemSettingPayload, type ItemSettingPayload } from "@/lib/queries/admin";
type R = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });

export async function updateSystemSetting(key: string, valueJson: string): Promise<R> {
  const p = await getProfile(); if (p?.role !== "admin") return { ok: false, error: "관리자만 변경할 수 있습니다" };
  let value: unknown; try { value = JSON.parse(valueJson); } catch { return { ok: false, error: "JSON 형식이 올바르지 않습니다" }; }
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("system_settings").update({ value: value as never, updated_by: p.user_id, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return fail(error);
  revalidatePath("/admin/settings"); return { ok: true };
}
export async function upsertSupplier(row: { id?: number; code: string; name: string; country?: string; prep_days: number; lead_time_days: number }): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!row.code.trim() || !row.name.trim()) return { ok: false, error: "코드와 이름은 필수입니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("supplier").upsert({ ...row, source: "manual", is_dummy: false, updated_by: p.user_id, updated_at: new Date().toISOString() }, { onConflict: "code" });
  if (error) return fail(error);
  revalidatePath("/admin/suppliers"); return { ok: true };
}
export async function deleteSupplier(id: number): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("supplier").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/suppliers"); return { ok: true };
}
export async function requestItemSettingApproval(itemCode: string, payload: ItemSettingPayload, reason: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const v = validateItemSettingPayload(payload, reason); if (!v.ok) return v;
  if (Object.keys(payload).length === 0) return { ok: false, error: "변경할 값이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").rpc("fn_request_approval", { p_kind: "item_setting", p_target_table: "app.item_setting", p_target_pk: itemCode, p_payload: payload as never, p_reason: reason });
  if (error) return fail(error.message.includes("ALREADY_PENDING") ? new Error("이미 승인 대기 중인 요청이 있습니다") : error);
  revalidatePath("/admin/item-settings"); revalidatePath("/approvals"); return { ok: true };
}
export async function upsertHoliday(date: string, name: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name.trim()) return { ok: false, error: "날짜(YYYY-MM-DD)와 이름은 필수입니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("holiday").upsert({ date, name, country: "KR" });
  if (error) return fail(error);
  revalidatePath("/admin/holidays"); return { ok: true };
}
export async function deleteHoliday(date: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("holiday").delete().eq("date", date);
  if (error) return fail(error);
  revalidatePath("/admin/holidays"); return { ok: true };
}
export async function upsertEol(model_base: string, launch_date: string | null, eol_date: string | null, eos_date: string | null): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("eol_eos").upsert({ model_base, launch_date: launch_date || null, eol_date: eol_date || null, eos_date: eos_date || null, source: "manual", is_dummy: false, updated_by: p.user_id, updated_at: new Date().toISOString() });
  if (error) return fail(error);
  revalidatePath("/admin/eol"); return { ok: true };
}
