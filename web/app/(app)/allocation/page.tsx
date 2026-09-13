import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster, canApprove } from "@/lib/auth/roles";
import { fetchQueue, fetchOpenInbound, fetchPendingPriority } from "@/lib/queries/allocation";
import { AllocationPanel } from "./AllocationPanel";
export default async function AllocationPage() {
  const p = await getProfile(); if (!p || !(canWriteMaster(p.role) || canApprove(p.role))) redirect("/dashboard");
  const sb = await createServerSupabase();
  const [queue, inbound, pending] = await Promise.all([fetchQueue(sb), fetchOpenInbound(sb), fetchPendingPriority(sb)]);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">재고 배정</h1><p className="text-sm text-muted-foreground">대기 주문 큐(우선순위 → 검토요청 순), 입고 처리(자동/수동 배정), 수동 우선배정(팀장 승인), 만료·알림 처리 (R-AL-10~17, R-AL-30).</p></div>
      <AllocationPanel queue={queue} inbound={inbound as never} pending={pending} />
    </div>
  );
}
