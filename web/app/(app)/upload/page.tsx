import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canUpload } from "@/lib/auth/roles";
import { drillHref } from "@/lib/drill";
import { cn } from "@/lib/utils";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { UploadLog } from "./UploadLog";
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ tab?: string; target?: string }> }) {
  const p = await getProfile(); if (!p || !canUpload(p.role)) redirect("/dashboard");
  const { tab, target } = await searchParams;
  const sb = await createServerSupabase();
  const logs = tab === "log" ? (await sb.schema("app").from("upload_log").select("*").order("uploaded_at", { ascending: false }).limit(100)).data ?? [] : [];
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">데이터 업로드</h1><p className="text-sm text-muted-foreground">파일 → 컬럼 매핑 → 검증 → 반영. 오류 행은 건너뛰고 이력에 기록됩니다 (D-007). 관리자 화면에서 개별 입력도 가능합니다.</p></div>
      <div className="flex gap-2">
        <Link scroll={false} href={drillHref("/upload", {})} className={cn("rounded-full border px-3 py-1 text-sm", tab !== "log" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>업로드</Link>
        <Link scroll={false} href={drillHref("/upload", { tab: "log" })} className={cn("rounded-full border px-3 py-1 text-sm", tab === "log" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>이력</Link>
      </div>
      {tab === "log" ? <UploadLog rows={logs} /> : <UploadWizard initialTarget={target} />}
    </div>
  );
}

/** Vercel 함수 시간 제한 상향 (계획 생성 ~20s·대량 업로드·LLM 응답). Pro 플랜 필요 (D-048) */
export const maxDuration = 60;
