import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
const LABEL: Record<string, string> = { target_dos_days: "목표 DoS", moq: "MOQ", unit_price: "단가", allocation_mode: "배정방식" };
const KIND_LABEL: Record<string, string> = { item_setting: "품목 설정", target_dos: "목표 DoS", allocation_mode: "배정방식", order_plan: "발주 계획", priority_alloc: "우선 배정", bulkdeal: "Bulkdeal 추가 발주", forecast_tuning: "AI 예측 조정", agent_order: "AI 감시 발주 제안" };
const PLAN_KEYS: Record<string, string> = { lines: "라인", amount: "금액", qty: "수량", stockout: "품절위험", blocked: "차단", flex_hit: "Flex", overrides: "오버라이드" };
export function describeApproval(a: { kind: string; target_pk: string; payload: Record<string, unknown> | null }, current?: Record<string, unknown> | null): string {
  if (a.kind === "forecast_tuning") {
    const props = (a.payload?.proposals ?? []) as { method_key: string; param_patch?: Record<string, unknown>; enabled?: boolean | null }[];
    return `AI 예측 조정: ` + props.map(p => `${p.method_key}${p.enabled != null ? `(${p.enabled ? "on" : "off"})` : ""} ${p.param_patch && Object.keys(p.param_patch).length ? JSON.stringify(p.param_patch) : ""}`.trim()).join(", ");
  }
  if (a.kind === "order_plan") return "발주 계획 승인: " + Object.entries(a.payload ?? {}).map(([k, v]) => `${PLAN_KEYS[k] ?? k} ${typeof v === "number" ? v.toLocaleString("ko-KR") : String(v)}`).join(", ");
  if (a.kind === "priority_alloc") { const p = a.payload ?? {}; return `우선 배정: ${p.order_no} · ${p.item_code} ${p.qty}개 (가용 ${p.available}) — 등록 순서 건너뜀`; }
  if (a.kind === "agent_order") { const p = a.payload ?? {}; return `AI 감시 발주 제안: ${p.item_code} ${Number(p.qty ?? 0).toLocaleString("ko-KR")}개 (${p.need_ym}) — ${p.reason ?? ""} · 승인 시 추가수요(수급회의)로 반영`; }
  if (a.kind === "bulkdeal") { const p = a.payload ?? {}; return `Bulkdeal 추가 발주: ${p.item_code} ${p.qty}개 (${p.need_ym}) · 고객 ${p.customer} · 기종 ${p.model}`; }
  const parts = Object.entries(a.payload ?? {}).map(([k, v]) => `${LABEL[k] ?? k} ${current?.[k] ?? "-"} → ${v}`);
  const subject = a.kind === "item_setting" ? `품목 ${a.target_pk}` : `${KIND_LABEL[a.kind] ?? a.kind} ${a.target_pk}`;
  return `${subject}: ${parts.join(", ")}`;
}
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;
export function validateDecision(d: "approved" | "rejected", comment: string): { ok: true } | { ok: false; error: string } {
  if (d === "rejected" && !comment.trim()) return { ok: false, error: "반려 사유를 입력하세요" };
  return { ok: true };
}
export type ApprovalStatus = "pending" | "approved" | "rejected";
export async function fetchApprovals(sb: SupabaseClient<Database>, status: ApprovalStatus) {
  const { data, error } = await sb.schema("app").from("v_my_approvals").select("*").eq("status", status).order("requested_at", { ascending: false }).limit(200);
  if (error) throw error;
  const rows = data ?? [];
  // 현재값 (item_setting 대상) — 설명 문장용
  const codes = rows.filter(r => r.kind === "item_setting").map(r => r.target_pk!);
  const cur = codes.length ? (await sb.schema("app").from("v_item_setting").select("item_code,target_dos_days,moq,unit_price,allocation_mode").in("item_code", codes)).data ?? [] : [];
  const curMap = new Map(cur.map(c => [c.item_code, c as unknown as Record<string, unknown>]));
  return rows.map(r => ({ ...r, description: describeApproval({ kind: r.kind!, target_pk: r.target_pk!, payload: r.payload as Record<string, unknown> }, curMap.get(r.target_pk!)) }));
}
export type ApprovalRow = Awaited<ReturnType<typeof fetchApprovals>>[number];
