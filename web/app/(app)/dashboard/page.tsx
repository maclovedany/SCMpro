import { createServerSupabase } from "@/lib/supabase/server";
import { fetchDashboardSummary, cardsFromSummary } from "@/lib/queries/dashboard";
import { DrillCard } from "@/components/cards/DrillCard";
export default async function DashboardPage() {
  const sb = await createServerSupabase();
  const summary = await fetchDashboardSummary(sb);
  const cards = cardsFromSummary(summary);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">대시보드</h1>
        <p className="text-sm text-muted-foreground">카드를 클릭하면 해당 데이터로 이동합니다. 예측·발주 요약은 SP2/SP3 에서 추가됩니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => <DrillCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}
