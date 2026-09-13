import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export const DEPT_LABEL: Record<string, string> = { marketing: "마케팅부", sales: "영업부", service: "서비스부", biz_enable: "사업강화부" };
export type CalRow = { supplier_id: number; supplier_code: string; supplier_name: string; ym: string; sailing_date: string; order_date: string; eta: string };
export async function fetchCalendar(sb: SB, from: string, months: number): Promise<CalRow[]> {
  const { data } = await sb.schema("app").rpc("fn_order_calendar", { p_from: from, p_months: months }); return (data ?? []) as unknown as CalRow[];
}
export async function fetchSubmissionStatus(sb: SB, ym: string) {
  const { data } = await sb.schema("app").rpc("fn_submission_status", { p_ym: ym });
  return data as unknown as { ym: string; deadline: string; overdue: boolean; depts: { dept: string; submitted: boolean; submitted_at: string | null; by: string | null }[] | null };
}
export async function fetchInboundGap(sb: SB) {
  const [summary, rows] = await Promise.all([
    sb.schema("analytics").from("v_inbound_gap_summary").select("*").order("ym"),
    sb.schema("analytics").from("v_inbound_gap").select("*").order("actual_date", { ascending: false }).limit(200),
  ]);
  return { summary: summary.data ?? [], rows: rows.data ?? [] };
}
export function nextYm(d = new Date()) { const y = d.getFullYear(), m = d.getMonth() + 2; return `${y + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}`; }
export function thisYm(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
