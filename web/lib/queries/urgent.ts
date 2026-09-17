import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
type SB = SupabaseClient<Database>;
/** 긴급발주 진행 단계 (R-SCH-33, D-058). 순서 = DB enum inbound_stage 선언 순서 앞에 요청·승인을 붙인 것 */
export const URGENT_STAGES = ["requested", "approved", "po_accepted", "shipped", "departed", "arrived", "customs", "received"] as const;
export type UrgentStage = (typeof URGENT_STAGES)[number];
export const STAGE_LABEL: Record<string, string> = { requested: "요청", approved: "승인", po_accepted: "발주 접수", shipped: "출하", departed: "출항", arrived: "입항", customs: "통관", received: "입고 완료", rejected: "반려" };
/** SCM 이 기록할 수 있는 PO 이벤트 단계 (입고 완료는 재고 배정 화면의 "입고 완료" 로 처리) */
export const EVENT_STAGES = ["po_accepted", "shipped", "departed", "arrived", "customs"] as const;
export const stageIndex = (s: string) => (URGENT_STAGES as readonly string[]).indexOf(s);
export const progressPct = (s: string) => { const i = stageIndex(s); return i < 0 ? 0 : Math.round(i / (URGENT_STAGES.length - 1) * 100); };
export function urgentSteps(stage: string) {
  const i = stageIndex(stage);
  return URGENT_STAGES.map((s, k) => ({ stage: s, label: STAGE_LABEL[s], state: i < 0 ? "todo" as const : k < i ? "done" as const : k === i ? "current" as const : "todo" as const }));
}
export type UrgentRow = { id: string; item_code: string; description: string | null; qty: number; need_date: string | null; reason: string | null; status: string; requested_dept: string | null; requested_by_name: string | null;
  created_at: string; is_dummy: boolean; inbound_id: number | null; po_no: string | null; planned_date: string | null; actual_date: string | null; supplier_name: string | null; stage: string; delayed: boolean };
export async function fetchUrgent(sb: SB): Promise<UrgentRow[]> {
  const { data } = await sb.schema("analytics").from("v_urgent_progress").select("id,item_code,description,qty,need_date,reason,status,requested_dept,requested_by_name,created_at,is_dummy,inbound_id,po_no,planned_date,actual_date,supplier_name,stage,delayed").order("created_at", { ascending: false }).limit(200);
  return (data ?? []).map(u => ({ ...u, id: u.id ?? "", item_code: u.item_code ?? "", qty: Number(u.qty ?? 0), status: u.status ?? "", created_at: u.created_at ?? "", is_dummy: !!u.is_dummy, inbound_id: u.inbound_id == null ? null : Number(u.inbound_id), stage: u.stage ?? "requested", delayed: !!u.delayed }));
}
/** 긴급발주에 연결할 수 있는 미입고 PO (같은 품목) */
export async function fetchOpenPoForItems(sb: SB, codes: string[]) {
  if (!codes.length) return [] as { id: number; item_code: string; po_no: string | null; planned_date: string; qty: number }[];
  const { data } = await sb.schema("app").from("inbound").select("id,item_code,po_no,planned_date,qty").in("item_code", Array.from(new Set(codes))).neq("status", "received").order("planned_date").limit(300);
  return (data ?? []).map(p => ({ id: Number(p.id), item_code: p.item_code, po_no: p.po_no, planned_date: p.planned_date, qty: Number(p.qty) }));
}
