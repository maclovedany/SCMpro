import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchMyOrders, fetchAvailable } from "@/lib/queries/allocation";
import { canWriteMaster, canApprove } from "@/lib/auth/roles";
import { SalesOrderPanel } from "./SalesOrderPanel";
export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<{ item?: string; all?: string }> }) {
  const p = await getProfile(); if (!p) redirect("/login");
  const { item, all } = await searchParams;
  const sb = await createServerSupabase();
  const scm = canWriteMaster(p.role) || canApprove(p.role);
  const [orders, avail] = await Promise.all([fetchMyOrders(sb, all === "1" || scm, p.user_id), item ? fetchAvailable(sb, item) : Promise.resolve(null)]);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">영업 주문</h1><p className="text-sm text-muted-foreground">검토 요청 → 임시배정 30일(연장 불가) → 수주 확정 시 확정배정. 가용재고 = 현재고 − 임시배정 − 확정배정 − 승인대기 확보 (R-AL, R-INV-03).</p></div>
      <SalesOrderPanel orders={orders} avail={avail} item={item ?? ""} isScm={scm} me={p.user_id} />
    </div>
  );
}
