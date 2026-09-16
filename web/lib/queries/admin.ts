import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
export type ItemSettingPayload = { target_dos_days?: number; moq?: number; unit_price?: number; allocation_mode?: "auto" | "manual" };
/** 품목 설정 승인 요청 payload 검증 (R-OQ-02/30, 사유 필수) */
export function validateItemSettingPayload(p: ItemSettingPayload, reason: string): { ok: true } | { ok: false; error: string } {
  if (p.target_dos_days !== undefined && !(Number.isInteger(p.target_dos_days) && p.target_dos_days >= 1 && p.target_dos_days <= 365)) return { ok: false, error: "목표 DoS 는 1~365 일이어야 합니다" };
  if (p.moq !== undefined && !(Number.isInteger(p.moq) && p.moq >= 1)) return { ok: false, error: "MOQ 는 1 이상 정수여야 합니다" };
  if (p.unit_price !== undefined && !(p.unit_price >= 0)) return { ok: false, error: "단가는 0 이상이어야 합니다" };
  if (!reason || !reason.trim()) return { ok: false, error: "변경 사유를 입력하세요" };
  return { ok: true };
}
type SB = SupabaseClient<Database>;
export async function fetchSettings(sb: SB) {
  const { data, error } = await sb.schema("app").from("system_settings").select("*").order("key");
  if (error) throw error; return data;
}
export async function fetchSuppliers(sb: SB) {
  const { data, error } = await sb.schema("app").from("supplier").select("*").order("code");
  if (error) throw error; return data;
}
export type SupplierRow = Database["app"]["Tables"]["supplier"]["Row"];
export async function fetchItemSetting(sb: SB, code: string) {
  const [setting, master, audit, pending] = await Promise.all([
    sb.schema("app").from("v_item_setting").select("*").eq("item_code", code).maybeSingle(),
    sb.schema("analytics").from("v_item_master").select("key_code,description,category,family,avg_6m,on_hand,dos_days").eq("key_code", code).maybeSingle(),
    sb.schema("app").from("audit_log").select("id,action,before,after,actor,at").eq("table_name", "item_setting").eq("row_pk", code).order("at", { ascending: false }).limit(20),
    sb.schema("app").from("approval").select("id,payload,reason,requested_at,status").eq("kind", "item_setting").eq("target_pk", code).eq("status", "pending").maybeSingle(),
  ]);
  return { setting: setting.data, master: master.data, audit: audit.data ?? [], pending: pending.data };
}
export async function fetchHolidays(sb: SB, year: number) {
  const { data, error } = await sb.schema("app").from("holiday").select("*").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).order("date");
  if (error) throw error; return data;
}
export async function fetchEol(sb: SB) {
  const [models, eol] = await Promise.all([
    sb.schema("analytics").from("v_model").select("model_base,biz").order("model_base"),   // D-056: 화면은 analytics 만
    sb.schema("app").from("eol_eos").select("*"),
  ]);
  const map = new Map((eol.data ?? []).map(e => [e.model_base, e]));
  const seen = new Set<string>();
  return (models.data ?? []).filter(m => m.model_base && !seen.has(m.model_base) && seen.add(m.model_base)).map(m => ({ model_base: m.model_base!, biz: m.biz, ...(map.get(m.model_base!) ?? {}) }));
}
