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
      <div><h1 className="text-xl font-semibold">시스템 설정</h1><p className="text-sm text-muted-foreground">리드타임·Flex 범위·DoS 기간 등 하드코딩 금지 값 (CLAUDE.md 규칙 6). 값은 JSON.</p></div>
      <SettingsForm rows={rows.map(r => ({ key: r.key, value: JSON.stringify(r.value), description: r.description, updated_at: r.updated_at }))} />
    </div>
  );
}
