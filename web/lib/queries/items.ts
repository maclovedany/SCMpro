import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
export type ItemMasterRow = Database["analytics"]["Views"]["v_item_master"]["Row"];
export type ItemFilters = { category?: string; q?: string; dummy?: boolean; target_dos?: "missing"; sort?: string; page?: number; abc?: string; xyz?: string; pattern?: string; champion?: string; stock?: "zero"; excess?: boolean };
export const PAGE = 200;
export const CATEGORIES = ["PART", "SUPPLY", "OPTION", "SW"] as const;
export function parseItemFilters(sp: Record<string, string | undefined>): ItemFilters {
  return { category: sp.category || undefined, q: sp.q || undefined, dummy: sp.dummy === "true" ? true : undefined,
    target_dos: sp.target_dos === "missing" ? "missing" : undefined, sort: sp.sort || undefined, page: sp.page ? Number(sp.page) : undefined,
    abc: sp.abc || undefined, xyz: sp.xyz || undefined, pattern: sp.pattern || undefined, champion: sp.champion || undefined, stock: sp.stock === "zero" ? "zero" : undefined, excess: sp.excess === "true" ? true : undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyItemFilters(q: any, f: ItemFilters) {
  if (f.category) q = q.eq("category", f.category);
  if (f.dummy) q = q.eq("setting_is_dummy", true);
  if (f.target_dos === "missing") q = q.is("target_dos_days", null);
  if (f.q) q = q.or(`key_code.ilike.%${f.q}%,description.ilike.%${f.q}%`);
  if (f.abc) q = q.eq("abc", f.abc);
  if (f.xyz) q = q.eq("xyz", f.xyz);
  if (f.pattern) q = q.eq("pattern", f.pattern);
  if (f.champion) q = q.eq("champion_method", f.champion);
  if (f.stock === "zero") q = q.or("on_hand.lte.0,on_hand.is.null");   // 재고 0 (스냅샷 없음 포함)
  if (f.excess) q = q.eq("is_excess", true);                            // DoS ≥ 목표 2배 (D-034)
  return q;
}
export async function fetchItems(sb: SupabaseClient<Database>, f: ItemFilters): Promise<{ rows: ItemMasterRow[]; count: number }> {
  const page = f.page ?? 1;
  let q = sb.schema("analytics").from("v_item_master").select("*", { count: "exact" });
  q = applyItemFilters(q, f);
  const [col, dir] = (f.sort ?? "total_12m.desc").split(".");
  const { data, error, count } = await q.order(col, { ascending: dir !== "desc", nullsFirst: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}
export async function fetchItemDetail(sb: SupabaseClient<Database>, code: string) {
  const [master, monthly, xcn, models, setting, inbound, snapshots] = await Promise.all([
    sb.schema("analytics").from("v_item_master").select("*").eq("key_code", code).maybeSingle(),
    sb.schema("analytics").from("v_item_monthly").select("ym,qty").eq("key_code", code).order("ym"),
    sb.schema("core").from("v_part_linkage").select("related_item").eq("hoc_item", code),
    sb.schema("core").from("v_option_model_link").select("model_base,link_source,is_sw").eq("item_code", code),
    sb.schema("app").from("v_item_setting").select("*").eq("item_code", code).maybeSingle(),
    sb.schema("app").from("inbound").select("id,po_no,qty,planned_date,actual_date,status,is_dummy,supplier:supplier_id(code,name)").eq("item_code", code).order("planned_date"),
    sb.schema("app").from("inventory_snapshot").select("snap_date,qty,stock_class,is_dummy").eq("item_code", code).order("snap_date", { ascending: false }).limit(24),
  ]);
  if (master.error) throw master.error;
  return { master: master.data, monthly: monthly.data ?? [], xcn: xcn.data ?? [], models: models.data ?? [], setting: setting.data, inbound: inbound.data ?? [], snapshots: snapshots.data ?? [] };
}
export type ItemDetail = Awaited<ReturnType<typeof fetchItemDetail>>;
