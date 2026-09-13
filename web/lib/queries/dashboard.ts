import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct, fmtDate } from "@/lib/format";
export type DashboardSummary = { items_by_category: Record<string, number>; dummy_ratio: number | null; pending_approvals: number;
  last_upload: { file_name: string; uploaded_at: string; ok_count: number; error_count: number } | null; snapshot_date: string | null; missing_target_dos: number };
export async function fetchDashboardSummary(sb: SupabaseClient<Database>): Promise<DashboardSummary> {
  const { data, error } = await sb.schema("app").rpc("fn_dashboard_summary");
  if (error) throw error;
  return data as unknown as DashboardSummary;
}
export type CardSpec = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger" };
/** 대시보드 카드 6개 — 전부 드릴다운 href (R-UI-01) */
export function cardsFromSummary(s: DashboardSummary): CardSpec[] {
  const cat = s.items_by_category ?? {};
  const total = Object.entries(cat).filter(([k]) => k !== "SW").reduce((a, [, v]) => a + v, 0);
  const staleDays = s.snapshot_date ? Math.floor((Date.now() - Date.parse(s.snapshot_date)) / 86_400_000) : Infinity;
  return [
    { label: "예측 대상 품목", value: fmtInt(total), hint: ["PART", "SUPPLY", "OPTION"].map(k => `${k} ${fmtInt(cat[k] ?? 0)}`).join(" · ") + ` · SW ${fmtInt(cat.SW ?? 0)} 제외`, href: drillHref("/items", {}) },
    { label: "더미 설정 비율", value: fmtPct(s.dummy_ratio), hint: "실데이터 업로드 시 감소 (D-007)", href: drillHref("/items", { dummy: true }), tone: (s.dummy_ratio ?? 0) > 0.5 ? "warn" : "default" },
    { label: "승인 대기", value: fmtInt(s.pending_approvals), hint: "SCM팀장 결재 필요", href: drillHref("/approvals", { status: "pending" }), tone: s.pending_approvals > 0 ? "warn" : "default" },
    { label: "최근 업로드", value: s.last_upload ? `${fmtInt(s.last_upload.ok_count)}건` : "-", hint: s.last_upload ? `${s.last_upload.file_name} · 오류 ${s.last_upload.error_count}` : "업로드 이력 없음", href: drillHref("/upload", { tab: "log" }), tone: (s.last_upload?.error_count ?? 0) > 0 ? "warn" : "default" },
    { label: "재고 스냅샷 기준일", value: fmtDate(s.snapshot_date), hint: isFinite(staleDays) ? `${staleDays}일 전` : "스냅샷 없음", href: drillHref("/items", { sort: "snap_date.desc" }), tone: staleDays > 30 ? "warn" : "default" },
    { label: "목표 DoS 미설정", value: fmtInt(s.missing_target_dos), hint: "발주 확정 차단 대상 (R-OQ-03)", href: drillHref("/items", { target_dos: "missing" }), tone: s.missing_target_dos > 0 ? "danger" : "default" },
  ];
}
