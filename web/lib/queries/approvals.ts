import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
const LABEL: Record<string, string> = { target_dos_days: "목표 DoS", moq: "MOQ", unit_price: "단가", allocation_mode: "배정방식" };
const KIND_LABEL: Record<string, string> = { item_setting: "품목 설정", target_dos: "목표 DoS", allocation_mode: "배정방식", order_plan: "발주 계획", priority_alloc: "우선 배정", bulkdeal: "Bulkdeal 추가 발주" };
export function describeApproval(a: { kind: string; target_pk: string; payload: Record<string, unknown> | null }, current?: Record<string, unknown> | null): string {
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
