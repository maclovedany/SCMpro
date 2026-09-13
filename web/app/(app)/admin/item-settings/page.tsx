import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchItemSetting } from "@/lib/queries/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ItemSettingForm } from "./ItemSettingForm";
export default async function ItemSettingsPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const { item } = await searchParams;
  const sb = await createServerSupabase();
  const data = item ? await fetchItemSetting(sb, item) : null;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">품목 설정</h1><p className="text-sm text-muted-foreground">목표 DoS · MOQ · 단가 · 배정방식. 변경은 사유와 함께 SCM팀장 승인을 거칩니다 (R-OQ-02, R-AL-10).</p></div>
      <form action="/admin/item-settings" className="flex gap-2">
        <Input name="item" defaultValue={item ?? ""} placeholder="품목 코드 (HOC) 입력" className="h-9 w-72 font-mono" />
        <Button size="sm" type="submit">조회</Button>
      </form>
      {item && data && (data.master ? <ItemSettingForm code={item} data={data} /> : <p className="text-sm text-red-600">품목 {item} 을 찾을 수 없습니다 (예측 대상 품목만 설정 가능).</p>)}
    </div>
  );
}
