import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchGroupStock } from "@/lib/queries/customers";
import { ItemGroupPanel } from "./ItemGroupPanel";
export default async function ItemGroupsPage() {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const sb = await createServerSupabase();
  const [stock, groups] = await Promise.all([fetchGroupStock(sb), sb.schema("app").from("item_group").select("code,name,owner_dept,is_dummy").order("code")]);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">품목 그룹</h1><p className="text-sm text-muted-foreground">품목 → 제품군 → 담당 부서 (R-INV-09). 담당 부서의 대시보드에 그룹 재고가 표시됩니다. 데이터 업로드 › 「품목 그룹」 으로 일괄 반영할 수 있습니다 (D-007).</p></div>
      <ItemGroupPanel groups={(groups.data ?? []).map(g => ({ code: g.code, name: g.name, owner_dept: g.owner_dept as string | null, is_dummy: g.is_dummy }))} stock={stock} />
    </div>
  );
}
