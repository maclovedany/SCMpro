import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchMethods } from "@/lib/queries/forecast";
import { MethodTable } from "./MethodTable";
export default async function ForecastMethodsPage() {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const { methods, policy } = await fetchMethods(await createServerSupabase());
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">예측 기법 설정</h1><p className="text-sm text-muted-foreground">기법 on/off · 파라미터 (D-018, R-FC-34) 와 ABC-XYZ 셀별 정책 (R-FC-35). 변경은 다음 런부터 적용, 이력은 audit_log.</p></div>
      <MethodTable methods={methods} policy={policy} />
    </div>
  );
}
