import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchSuppliers } from "@/lib/queries/admin";
import { SupplierTable } from "./SupplierTable";
export default async function SuppliersPage() {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const sb = await createServerSupabase();
  const rows = await fetchSuppliers(sb);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">공급처</h1><p className="text-sm text-muted-foreground">출항 준비기간·리드타임은 발주 일정의 기준 (R-SCH-02). 업로드로도 반영 가능 (D-007).</p></div>
      <SupplierTable rows={rows} />
    </div>
  );
}
