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
      <div><h1 className="text-xl font-semibold">예측 기법 설정</h1><p className="text-sm text-muted-foreground">어떤 예측 기법을 쓸지 켜고 끄고, 기법마다 몇 가지 설정을 조정합니다. 바꾼 값은 다음 예측 런부터 적용되고 이력이 남습니다. 무엇을 바꿔야 할지 모르면 예측 › 런 의 AI 조정 제안을 따르세요.</p></div>
      <MethodTable methods={methods} policy={policy} />
    </div>
  );
}
