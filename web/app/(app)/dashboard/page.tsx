import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchDashboardV2, sectionsForRole, buildKpis, chartData } from "@/lib/queries/dashboard";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { DrillCard } from "@/components/cards/DrillCard";
import { KpiTile } from "@/components/cards/KpiTile";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardExtCharts } from "./DashboardExtCharts";
import { fetchDashboardExt, extSections, extCharts, mergeSections } from "@/lib/queries/dashboardExt";
/** SCM 관점 대시보드 (D-031/D-032, R-UI-12/13): KPI 스트립 + 역할별 섹션(카드 3 + 차트 1) */
export default async function DashboardPage() {
  const p = await getProfile(); if (!p) redirect("/login");
  const sb = await createServerSupabase();
  const [d, x] = await Promise.all([fetchDashboardV2(sb), fetchDashboardExt(sb)]);
  const sections = mergeSections(extSections(p.role, x), sectionsForRole(p.role, d)); const kpis = buildKpis(d); const charts = chartData(d); const xCharts = extCharts(x);
  const EXT = new Set(["inv", "mygroup", "urgent", "custalloc"]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">대시보드</h1><p className="text-sm text-muted-foreground">{ROLE_LABEL[p.role]} 관점으로 정렬 · 카드와 차트를 클릭하면 근거 목록으로 이동합니다. 노란 배경 = 주의, 빨간 배경 = 즉시 조치.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="kpi-strip">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      {sections.map(s => (
        <section key={s.key} data-testid={`dash-${s.key}`}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{s.title}</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">{s.cards.map(c => <DrillCard key={c.label} {...c} accent={s.accent} compact />)}</div>
            <div className="lg:col-span-3">{EXT.has(s.key) ? <DashboardExtCharts section={s.key} charts={xCharts} /> : <DashboardCharts section={s.key} charts={charts} planId={d.cycle.plan?.id ?? null} />}</div>
          </div>
        </section>
      ))}
    </div>
  );
}
