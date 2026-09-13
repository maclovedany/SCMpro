"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestRun } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function RunRequestForm() {
  const [fy, setFy] = useState("2026"); const [h, setH] = useState("6");
  const [pending, start] = useTransition();
  const go = (t: "backtest" | "production") => start(async () => { const r = await requestRun(t, Number(fy), Number(h)); if (r.ok) toast.success("런을 요청했습니다 — 엔진이 처리하면 목록에 반영됩니다"); else toast.error(r.error); });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
      <span>백테스트 평가 FY</span><Input value={fy} onChange={e => setFy(e.target.value)} className="h-8 w-20" /><Button size="sm" disabled={pending} onClick={() => go("backtest")}>백테스트 요청</Button>
      <span className="ml-4">프로덕션 지평선(개월)</span><Input value={h} onChange={e => setH(e.target.value)} className="h-8 w-16" /><Button size="sm" variant="outline" disabled={pending} onClick={() => go("production")}>프로덕션 예측 요청</Button>
    </div>
  );
}
