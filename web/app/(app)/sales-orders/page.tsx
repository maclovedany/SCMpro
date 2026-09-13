import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchMyOrders, fetchAvailable } from "@/lib/queries/allocation";
import { canWriteMaster, canApprove } from "@/lib/auth/roles";
import { SalesOrderPanel } from "./SalesOrderPanel";
import { headers } from "next/headers";
export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<{ item?: string; all?: string }> }) {
  const p = await getProfile(); if (!p) redirect("/login");
  const { item, all } = await searchParams;
  const sb = await createServerSupabase();
  await headers();                       // 동적 렌더 보장 후 기준 시각 (React Compiler 순수성 규칙 회피: 요청당 1회)
  const now = new Date().getTime();
  const scm = canWriteMaster(p.role) || canApprove(p.role);
  const [orders, avail] = await Promise.all([fetchMyOrders(sb, all === "1" || scm, p.user_id), item ? fetchAvailable(sb, item) : Promise.resolve(null)]);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">영업 주문</h1><p className="text-sm text-muted-foreground">검토 요청 → 임시배정 30일(연장 불가) → 수주 확정 시 확정배정. 가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기 확보 (R-AL, R-INV-03).</p></div>
      <SalesOrderPanel orders={orders} avail={avail} item={item ?? ""} isScm={scm} me={p.user_id} now={now} />
    </div>
  );
}
