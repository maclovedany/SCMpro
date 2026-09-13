import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchTempOrders } from "@/lib/queries/allocation";
import { PriorityTable } from "./PriorityTable";
export default async function PriorityPage() {
  const p = await getProfile(); if (!p || !["biz_enable", "scm_lead", "admin"].includes(p.role)) redirect("/dashboard");
  const rows = await fetchTempOrders(await createServerSupabase());
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">임시배정 우선순위</h1><p className="text-sm text-muted-foreground">사업강화부가 자동 배정 순서를 조정합니다 (숫자 작을수록 우선, 같은 값은 검토요청 순). 변경 전후·변경자·시각은 이력으로 남습니다 (R-AL-20).</p></div>
      <PriorityTable rows={rows} />
    </div>
  );
}
