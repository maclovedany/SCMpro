import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchCalendar, fetchSubmissionStatus, fetchInboundGap, scheduleCharts, nextYm, thisYm } from "@/lib/queries/schedule";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { fmtInt, fmtNum, fmtDateTime } from "@/lib/format";
import { SchedulePanel } from "./SchedulePanel";
import { ScheduleCharts } from "./ScheduleCharts";
/** 일정·제출·입고 (D-036, R-UI-13): KPI 4 + 차트 4 + 캘린더·제출·입고 차이 표 */
export default async function SchedulePage() {
  const p = await getProfile();
  const sb = await createServerSupabase();
  const from = thisYm(); const target = nextYm();
  const [cal, sub, gap] = await Promise.all([fetchCalendar(sb, from, 3), fetchSubmissionStatus(sb, target), fetchInboundGap(sb)]);
  const today = new Date().toISOString().slice(0, 10);
  const next = cal.filter(c => c.order_date! >= today).sort((a, b) => a.order_date!.localeCompare(b.order_date!))[0];
  const thisMonth = cal.filter(c => c.ym === from);
  const missing = (sub.depts ?? []).filter(d => !d.submitted);
  const avgDiff = gap.rows.length ? gap.rows.reduce((a, r) => a + Number(r.diff_days ?? 0), 0) / gap.rows.length : null;
  const c = scheduleCharts(cal, sub, gap);
  const dDay = next ? Math.round((Date.parse(next.order_date!) - Date.parse(today)) / 86400e3) : null;
  const kpis: KpiTileProps[] = [
    { label: "다음 발주일", value: next?.order_date ?? "-", sub: next ? `${next.supplier_name} · 출항 ${next.sailing_date} · 입고예정 ${next.eta}` : "캘린더 없음", href: "#calendar", accent: "cycle", icon: "CalendarClock", delta: dDay == null ? undefined : { text: dDay === 0 ? "오늘" : `D-${dDay}`, dir: "flat", good: dDay > 1 }, tone: dDay != null && dDay <= 1 ? "warn" : "default" },
    { label: `이번 달(${from}) 발주 회차`, value: fmtInt(thisMonth.length), sub: "공급처 × 출항 주차", href: "#calendar", accent: "cycle", icon: "Ship" },
    { label: `${target} 수요자료 미제출`, value: fmtInt(missing.length), sub: `마감 ${sub.deadline}${sub.overdue ? " · 마감 경과" : ""}`, href: "#submission", accent: "ops", icon: "FileWarning", tone: missing.length && sub.overdue ? "danger" : missing.length ? "warn" : "default", progress: { pct: c.submission.pct, label: `${c.submission.done}/${c.submission.total} 부서 제출` } },
    { label: "입고 차이 평균(일)", value: avgDiff == null ? "-" : fmtNum(avgDiff, 1), sub: `실입고 ${fmtInt(gap.rows.length)}건 (+지연 / −조기)`, href: "#gap", accent: "stock", icon: "Timer", tone: avgDiff != null && avgDiff > 3 ? "warn" : "default" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">발주 일정 · 제출 · 입고</h1><p className="text-sm text-muted-foreground">공급처 출항일 → 발주일(−준비기간)·입고예정(+선적 7일), 주말·공휴일은 이전 영업일 (R-SCH-01~05). 수요자료 마감 = 전월 말일−1, 미제출 부서 10분 반복 알림 (R-SCH-20/21). pg_cron 10분 tick.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="sc-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="sc-charts">
        <ScheduleCharts kind="rounds" c={c} /><ScheduleCharts kind="submission" c={c} depts={sub.depts ?? []} target={target} /><ScheduleCharts kind="gap" c={c} /><ScheduleCharts kind="dist" c={c} />
      </div>
      <SchedulePanel cal={cal} sub={sub} gap={gap} role={p?.role ?? "sales"} target={target} />
      <p className="text-xs text-muted-foreground">기준 {fmtDateTime(new Date().toISOString())}</p>
    </div>
  );
}
