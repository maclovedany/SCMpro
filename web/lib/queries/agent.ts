import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
export const SIGNAL_LABEL: Record<string, string> = { stockout: "품절 위험", low_dos: "재고 부족(DoS)", inbound_delay: "입고 지연", lead_imminent: "발주일 임박", demand_surge: "수요 급증" };
export const STATUS_LABEL: Record<string, string> = { open: "감지", notified: "알림됨", proposed: "제안(승인 대기)", accepted: "승인·반영", dismissed: "반려", resolved: "해소" };
export type AgentEvent = { id: string; key: string; signal: string; item_code: string | null; category: string | null; supplier: string | null; severity: number | null; status: string;
  first_seen: string; last_seen: string; last_notified_at: string | null; notified_count: number; evidence: Record<string, unknown> | null;
  judgment: { severity?: number; action?: string; qty?: number | null; need_ym?: string | null; reason?: string; by?: string } | null; approval_id: string | null; feedback: string | null };
export type AgentStats = { open: number; proposed: number; accepted: number; dismissed: number; resolved: number; useful: number; not_useful: number; severe: number; by_signal: { signal: string; n: number }[] };
export async function fetchAgentEvents(sb: SB, f: { status?: string; signal?: string }) {
  let q = sb.schema("app").from("agent_event").select("*").order("severity", { ascending: false, nullsFirst: false }).order("last_seen", { ascending: false }).limit(300);
  if (f.status === "active") q = q.in("status", ["open", "notified", "proposed"]); else if (f.status) q = q.eq("status", f.status);
  if (f.signal) q = q.eq("signal", f.signal);
  const { data, error } = await q; if (error) throw error;
  return (data ?? []) as unknown as AgentEvent[];
}
export async function fetchAgentStats(sb: SB, days = 30): Promise<AgentStats> {
  const { data, error } = await sb.schema("app").rpc("fn_agent_stats", { p_days: days }); if (error) throw error;
  const d = (data ?? {}) as Partial<AgentStats>;
  return { open: Number(d.open ?? 0), proposed: Number(d.proposed ?? 0), accepted: Number(d.accepted ?? 0), dismissed: Number(d.dismissed ?? 0), resolved: Number(d.resolved ?? 0), useful: Number(d.useful ?? 0), not_useful: Number(d.not_useful ?? 0), severe: Number(d.severe ?? 0), by_signal: d.by_signal ?? [] };
}
/** 채택률·유용률 (순수 함수) */
export function agentRates(s: AgentStats) {
  const decided = s.accepted + s.dismissed; const fb = s.useful + s.not_useful;
  return { adoption: decided ? s.accepted / decided : null, useful: fb ? s.useful / fb : null };
}
/** 근거 요약 한 줄 */
export function evidenceLine(e: AgentEvent): string {
  const v = (e.evidence ?? {}) as Record<string, unknown>; const n = (x: unknown) => (x == null ? "-" : Number(x).toLocaleString("ko-KR"));
  switch (e.signal) {
    case "stockout": return `필요월 ${v.need_ym} · 기초 ${n(v.start_need)} − 수요 ${n(v.forecast_need)}+${n(v.extras)} · 발주 ${n(v.final_qty)} → 기말 ${n(v.end_after)} · 부족 ${n(v.shortage)} (MOQ ${n(v.moq)})`;
    case "low_dos": return `현재고 ${n(v.on_hand)} · 6M 평균 ${n(v.avg_6m)}/월 · DoS ${n(v.dos_days)}일 (목표 ${n(v.target_dos_days)}) · 입고예정 ${n(v.inbound_qty)}`;
    case "inbound_delay": return `${v.supplier ?? "-"} ${v.po_no ?? ""} ${n(v.qty)}개 · 계획 ${v.planned_date} · ${n(v.days_late)}일 지연 (${v.status})`;
    case "lead_imminent": return `${v.supplier} 발주일 ${v.order_date} (D-${n(v.days_left)}) · ${v.plan_ym} 계획 ${v.plan_status ?? "없음"}`;
    case "demand_surge": return `${v.ym} 출고 ${n(v.actual)} = 6M 평균 ${n(v.avg_6m)} × ${v.ratio}`;
    default: return JSON.stringify(v);
  }
}
