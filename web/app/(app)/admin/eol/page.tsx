import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchEol } from "@/lib/queries/admin";
import { EolTable } from "./EolTable";
export default async function EolPage() {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const rows = await fetchEol(await createServerSupabase());
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">EOL / EOS</h1><p className="text-sm text-muted-foreground">출시 → 약 5년 EOL(판매 종료) → 약 5년 EOS(부품·소모품 종료). 예측 수렴에 사용 (R-FC-07). 업로드로도 반영 가능.</p></div>
      <EolTable rows={rows} />
    </div>
  );
}
