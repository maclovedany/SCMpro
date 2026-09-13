import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchCalendar, fetchSubmissionStatus, fetchInboundGap, nextYm, thisYm, DEPT_LABEL } from "@/lib/queries/schedule";
import { DrillCard } from "@/components/cards/DrillCard";
import { fmtInt, fmtNum, fmtDateTime } from "@/lib/format";
import { SchedulePanel } from "./SchedulePanel";
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
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">발주 일정 · 제출 · 입고</h1><p className="text-sm text-muted-foreground">공급처 출항일 → 발주일(−준비기간)·입고예정(+선적 7일), 주말·공휴일은 이전 영업일 (R-SCH-01~05). 수요자료 마감 = 전월 말일−1, 미제출 부서 10분 반복 알림 (R-SCH-20/21). pg_cron 10분 tick.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label="다음 발주일" value={next?.order_date ?? "-"} hint={next ? `${next.supplier_name} · 출항 ${next.sailing_date} · 입고예정 ${next.eta}` : "캘린더 없음"} href="#calendar" />
        <DrillCard label={`이번 달(${from}) 발주 회차`} value={fmtInt(thisMonth.length)} hint="공급처 × 출항 주차" href="#calendar" />
        <DrillCard label={`${target} 수요자료 미제출`} value={fmtInt(missing.length)} hint={`마감 ${sub.deadline}${sub.overdue ? " · 마감 경과" : ""}`} href="#submission" tone={missing.length && sub.overdue ? "danger" : missing.length ? "warn" : "default"} />
        <DrillCard label="입고 차이 평균(일)" value={avgDiff == null ? "-" : fmtNum(avgDiff, 1)} hint={`실입고 ${fmtInt(gap.rows.length)}건 (+지연 / −조기)`} href="#gap" />
      </div>
      <SchedulePanel cal={cal} sub={sub} gap={gap} role={p?.role ?? "sales"} target={target} />
      <p className="text-xs text-muted-foreground">기준 {fmtDateTime(new Date().toISOString())}</p>
    </div>
  );
}
