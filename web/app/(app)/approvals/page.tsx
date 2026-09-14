import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canApprove, canWriteMaster } from "@/lib/auth/roles";
import { fetchApprovals, type ApprovalStatus } from "@/lib/queries/approvals";
import { drillHref } from "@/lib/drill";
import { cn } from "@/lib/utils";
import { ApprovalList } from "./ApprovalList";
const TABS: { s: ApprovalStatus; label: string }[] = [{ s: "pending", label: "대기" }, { s: "approved", label: "승인" }, { s: "rejected", label: "반려" }];
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const p = await getProfile(); if (!p || !(canApprove(p.role) || canWriteMaster(p.role))) redirect("/dashboard");
  const { status } = await searchParams; const st = (TABS.some(t => t.s === status) ? status : "pending") as ApprovalStatus;
  const rows = await fetchApprovals(await createServerSupabase(), st);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">승인함</h1><p className="text-sm text-muted-foreground">품목 설정·발주 계획·우선 배정 등 SCM팀장 결재. 승인 시 대상에 즉시 반영되고 요청자에게 알림이 갑니다.</p></div>
      <div className="flex gap-2">{TABS.map(t => <Link scroll={false} key={t.s} href={drillHref("/approvals", { status: t.s })} className={cn("rounded-full border px-3 py-1 text-sm", st === t.s ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{t.label}</Link>)}</div>
      <ApprovalList rows={rows} canDecide={canApprove(p.role)} />
    </div>
  );
}
