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

/** 일정 화면 차트 데이터 (D-036, 순수 함수): 공급처별 발주 회차(월), 제출 현황, 입고 차이(공급처×월), 지연/정시/조기 분포 */
export function scheduleCharts(cal: Pick<CalRow, "supplier_name" | "ym" | "order_date">[], sub: { deadline: string; overdue: boolean; depts: { dept: string; submitted: boolean }[] | null }, gap: { summary: { supplier_code: string | null; ym: string | null; avg_diff: number | null }[]; rows: { diff_days: number | null }[] }) {
  const months = Array.from(new Set(cal.map(c => c.ym))).sort(); const sups = Array.from(new Set(cal.map(c => c.supplier_name))).sort();
  const rounds = { categories: months, series: sups.map(s => ({ name: s, data: months.map(m => cal.filter(c => c.ym === m && c.supplier_name === s).length) })), insight: months[0] ? `${months[0]} 발주 ${cal.filter(c => c.ym === months[0]).length}회 (공급처 ${sups.length}곳) — 출항 주차마다 발주일 = 출항일 − 준비기간` : "캘린더 없음" };
  const depts = sub.depts ?? []; const done = depts.filter(d => d.submitted).length;
  const submission = { done, total: depts.length, pct: depts.length ? Math.round(100 * done / depts.length) : 0, insight: depts.length ? (done === depts.length ? "전 부서 제출 완료" : `${depts.length - done}개 부서 미제출 · 마감 ${sub.deadline}${sub.overdue ? " (경과 — 10분마다 알림)" : ""}`) : "-" };
  const gm = Array.from(new Set(gap.summary.map(s => s.ym!))).sort(); const gs = Array.from(new Set(gap.summary.map(s => s.supplier_code ?? "-"))).sort();
  const gapChart = { categories: gm, series: gs.map(s => ({ name: s, data: gm.map(m => { const v = gap.summary.find(x => x.supplier_code === s && x.ym === m)?.avg_diff; return v == null ? null : Number(v); }) })) };
  const late = gap.rows.filter(r => Number(r.diff_days ?? 0) > 0).length, early = gap.rows.filter(r => Number(r.diff_days ?? 0) < 0).length, ontime = gap.rows.length - late - early;
  const worst = gap.summary.length ? [...gap.summary].sort((a, b) => Math.abs(Number(b.avg_diff ?? 0)) - Math.abs(Number(a.avg_diff ?? 0)))[0] : null;
  const dist = { data: [{ name: "지연", value: late }, { name: "정시", value: ontime }, { name: "조기", value: early }], insight: gap.rows.length ? `실입고 ${gap.rows.length}건 중 지연 ${late} · 정시 ${ontime} · 조기 ${early}${worst ? ` — ${worst.supplier_code} ${worst.ym} 평균 ${Number(worst.avg_diff ?? 0) >= 0 ? "+" : ""}${worst.avg_diff}일` : ""}` : "실입고 데이터 없음 — 재고 배정 화면에서 입고 처리하면 집계됩니다" };
  return { rounds, submission, gap: { ...gapChart, insight: dist.insight }, dist };
}
export type ScheduleCharts = ReturnType<typeof scheduleCharts>;
