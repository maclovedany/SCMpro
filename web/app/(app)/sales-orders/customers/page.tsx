import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchCustomerAllocation, customerAllocSummary, customerAllocCharts } from "@/lib/queries/customers";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { Badge } from "@/components/ui/badge";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtPct } from "@/lib/format";
import { CustomerAllocView } from "./CustomerAllocView";
/** 고객사별 배정현황 (R-AL-52, D-058): KPI → 차트(한 줄 해석) → 근거 표. 필요(수요자료 라인) 대비 최종 배정·부족 */
export default async function CustomerAllocPage({ searchParams }: { searchParams: Promise<{ customer?: string; short?: string }> }) {
  const p = await getProfile(); if (!p) redirect("/login");
  const { customer, short } = await searchParams; const shortOnly = short === "1" || short === "true";
  const all = await fetchCustomerAllocation(await createServerSupabase());
  const s = customerAllocSummary(all); const c = customerAllocCharts(s);
  const rows = all.filter(r => (!customer || r.customer_code === customer) && (!shortOnly || r.shortage_qty > 0));
  const picked = customer ? s.byCustomer.find(x => x.code === customer) : null;
  const dummy = all.some(r => r.is_dummy);
  const kpis: KpiTileProps[] = [
    { label: "고객사", value: `${fmtInt(s.customers)}곳`, sub: "수요자료 또는 진행 주문이 있는 고객사", href: "/sales-orders/customers", accent: "ops", icon: "Building2" },
    { label: "필요 수량", value: fmtInt(s.need), sub: "부서가 제출한 고객사별 필요 수량 (이번 달 이후)", href: "/schedule#demand-lines", accent: "cycle", icon: "ClipboardList" },
    { label: "배정 수량", value: fmtInt(s.allocated), sub: "임시배정 + 확정배정", href: "/sales-orders/customers", accent: "stock", icon: "PackageCheck", progress: s.fillRate == null ? undefined : { pct: s.fillRate * 100, label: `충족률 ${fmtPct(s.fillRate)}` } },
    { label: "부족 수량", value: fmtInt(s.shortage), sub: "필요 − 배정 · 입고 또는 강제배정 대상", href: drillHref("/sales-orders/customers", { short: 1 }), accent: "risk", icon: "AlertTriangle", tone: s.shortage > 0 ? "warn" : "default" },
    { label: "부족 고객사", value: `${fmtInt(s.shortCustomers)}곳`, sub: "필요 수량만큼 배정받지 못함", href: drillHref("/sales-orders/customers", { short: 1 }), accent: "risk", icon: "UserX", tone: s.shortCustomers > 0 ? "warn" : "default" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">고객사 배정현황</h1>
        <p className="text-sm text-muted-foreground">수요자료 제출 시 적은 <b>고객사별 필요 수량</b> 대비 최종 배정이 얼마나 되었는지 봅니다. 부족 = 필요 − (임시배정 + 확정배정). 필요 수량은 <Link href="/schedule#demand-lines" className="underline">일정·제출</Link>에서 입력합니다 (R-AL-52).
          {dummy && <Badge variant="secondary" className="ml-2">더미 포함</Badge>}</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="ca-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <CustomerAllocView charts={c} rows={rows} filter={{ customer: customer ?? null, customerName: picked?.name ?? null, shortOnly }} />
    </div>
  );
}
