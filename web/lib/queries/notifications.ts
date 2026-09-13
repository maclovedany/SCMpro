import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
export async function fetchNotifications(sb: SupabaseClient<Database>, unreadOnly: boolean) {
  let q = sb.schema("app").from("notification").select("*").order("created_at", { ascending: false }).limit(100);
  if (unreadOnly) q = q.is("read_at", null);
  const { data, error } = await q; if (error) throw error; return data ?? [];
}
export type NotificationRow = Database["app"]["Tables"]["notification"]["Row"];
/** 알림 클릭 시 이동할 곳 */
export function notificationHref(n: { kind: string; payload: unknown }): string {
  const p = (n.payload ?? {}) as { approval_id?: string; decision?: string; target_pk?: string };
  if (n.kind === "approval_requested") return "/approvals?status=pending";
  if (n.kind === "approval_decided") return `/approvals?status=${p.decision ?? "approved"}`;
  return "/dashboard";
}
