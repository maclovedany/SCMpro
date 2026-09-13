import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { fetchSettings } from "@/lib/queries/admin";
import { SettingsForm } from "./SettingsForm";
export default async function SettingsPage() {
  const p = await getProfile(); if (p?.role !== "admin") redirect("/dashboard");
  const sb = await createServerSupabase();
  const rows = await fetchSettings(sb);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">시스템 설정</h1><p className="text-sm text-muted-foreground">발주·예측·알림에 쓰는 기준값입니다. 값을 바꾸면 다음 계산(계획 재생성, 다음 예측 런, 다음 알림)부터 적용됩니다.</p></div>
      <SettingsForm rows={rows.map(r => ({ key: r.key, value: r.value, description: r.description, updated_at: r.updated_at }))} />
    </div>
  );
}
