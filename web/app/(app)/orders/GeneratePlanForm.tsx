"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generatePlan } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function GeneratePlanForm({ defaultYm }: { defaultYm: string }) {
  const [ym, setYm] = useState(defaultYm); const [pending, start] = useTransition(); const router = useRouter();
  return (
    <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
      <span>발주월</span><Input name="plan_ym" value={ym} onChange={e => setYm(e.target.value)} className="h-8 w-28" />
      <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await generatePlan(ym); if (r.ok) { toast.success("계획 생성 완료"); router.push(`/orders/${r.id}`); } else toast.error(r.error); })}>{pending ? "산출 중…" : "계획 생성 / 재생성"}</Button>
      <span className="text-xs text-muted-foreground">기존 초안은 교체됩니다. 설정(목표 DoS·MOQ·리드타임) 변경 후 재생성하면 즉시 반영.</span>
    </div>
  );
}
