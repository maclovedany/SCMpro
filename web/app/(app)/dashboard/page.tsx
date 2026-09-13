import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchDashboardV2, sectionsForRole } from "@/lib/queries/dashboard";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { DrillCard } from "@/components/cards/DrillCard";
/** SCM 관점 대시보드 (D-031, R-UI-12): 역할별 섹션 순서, 카드 전부 드릴다운 */
export default async function DashboardPage() {
  const p = await getProfile(); if (!p) redirect("/login");
  const sb = await createServerSupabase();
  const d = await fetchDashboardV2(sb);
  const sections = sectionsForRole(p.role, d);
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">대시보드</h1><p className="text-sm text-muted-foreground">{ROLE_LABEL[p.role]} 관점으로 정렬됨 · 카드를 클릭하면 근거 목록으로 이동합니다. 노란색 = 주의, 빨간색 = 즉시 조치.</p></div>
      {sections.map(s => (
        <section key={s.key} data-testid={`dash-${s.key}`}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{s.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{s.cards.map(c => <DrillCard key={c.label} {...c} />)}</div>
        </section>
      ))}
    </div>
  );
}
