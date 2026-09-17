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

// ── 고객사 마스터 (R-AL-51) · 품목 그룹 (R-INV-09) — D-058. 마스터 쓰기 권한(관리자·품목담당), RLS 가 한 번 더 막는다
export async function upsertCustomer(row: { code: string; name: string; segment: string; is_strategic: boolean }): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!row.code.trim() || !row.name.trim()) return { ok: false, error: "고객코드와 이름은 필수입니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("customer").upsert({ code: row.code.trim(), name: row.name.trim(), segment: row.segment.trim() || null, is_strategic: row.is_strategic, source: "manual", is_dummy: false, updated_by: p.user_id, updated_at: new Date().toISOString() });
  if (error) return fail(error); revalidatePath("/admin/customers"); revalidatePath("/sales-orders/customers"); return { ok: true };
}
export async function deleteCustomer(code: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").from("customer").delete().eq("code", code);
  if (error) return { ok: false, error: error.message.includes("foreign key") ? "주문·수요자료에서 쓰는 고객사는 지울 수 없습니다" : error.message };
  revalidatePath("/admin/customers"); return { ok: true };
}
export async function upsertItemGroup(row: { code: string; name: string; owner_dept: string }): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  if (!row.code.trim() || !row.name.trim()) return { ok: false, error: "그룹 코드와 이름은 필수입니다" };
  const sb = await createServerSupabase();
  const { error } = await sb.schema("app").from("item_group").upsert({ code: row.code.trim(), name: row.name.trim(), owner_dept: (row.owner_dept || null) as never, source: "manual", is_dummy: false, updated_by: p.user_id, updated_at: new Date().toISOString() });
  if (error) return fail(error); revalidatePath("/admin/item-groups"); revalidatePath("/dashboard"); return { ok: true };
}
export async function addGroupItem(groupCode: string, itemCode: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase(); const code = itemCode.trim();
  const { data: hit } = await sb.schema("analytics").from("v_item_name").select("item_code").eq("item_code", code).maybeSingle();
  if (!hit) return { ok: false, error: "품목 코드를 찾을 수 없습니다" };
  const { error } = await sb.schema("app").from("item_group_item").upsert({ item_code: code, group_code: groupCode });
  if (error) return fail(error); revalidatePath("/admin/item-groups"); revalidatePath("/items/groups"); revalidatePath("/dashboard"); return { ok: true };
}
export async function removeGroupItem(itemCode: string): Promise<R> {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) return { ok: false, error: "권한이 없습니다" };
  const sb = await createServerSupabase(); const { error } = await sb.schema("app").from("item_group_item").delete().eq("item_code", itemCode);
  if (error) return fail(error); revalidatePath("/admin/item-groups"); revalidatePath("/items/groups"); revalidatePath("/dashboard"); return { ok: true };
}
