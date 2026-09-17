import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchCustomers } from "@/lib/queries/customers";
import { CustomerTable } from "./CustomerTable";
export default async function CustomersPage() {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const rows = await fetchCustomers(await createServerSupabase());
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">고객사</h1><p className="text-sm text-muted-foreground">영업 주문·수요자료가 가리키는 고객 마스터 (R-AL-51). 데이터 업로드 › 「고객사」 로도 반영됩니다 (D-007). 「더미」 는 실데이터로 덮어쓰면 사라집니다.</p></div>
      <CustomerTable rows={rows} />
    </div>
  );
}
