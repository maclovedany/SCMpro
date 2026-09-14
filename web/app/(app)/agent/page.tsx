import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster, canApprove } from "@/lib/auth/roles";
import { fetchAgentEvents, fetchAgentStats, agentRates, SIGNAL_LABEL } from "@/lib/queries/agent";
import { KpiTile, type KpiTileProps } from "@/components/cards/KpiTile";
import { fmtInt, fmtPct } from "@/lib/format";
import { drillHref } from "@/lib/drill";
import { cn } from "@/lib/utils";
import { AgentTable } from "./AgentTable";
/** AI 감시 (자율 모드, D-042): 감지·판단·알림·제안 이벤트와 채택률 */
export default async function AgentPage({ searchParams }: { searchParams: Promise<{ status?: string; signal?: string }> }) {
  const p = await getProfile(); if (!p || !(canWriteMaster(p.role) || canApprove(p.role))) redirect("/dashboard");
  const sp = await searchParams; const status = sp.status ?? "active";
  const sb = await createServerSupabase();
  const [rows, stats, modeRow] = await Promise.all([fetchAgentEvents(sb, { status, signal: sp.signal }), fetchAgentStats(sb, 30), sb.schema("app").from("system_settings").select("value").eq("key", "agent_mode").maybeSingle()]);
  const mode = String(modeRow.data?.value ?? "off").replace(/"/g, ""); const rates = agentRates(stats);
  const MODE: Record<string, string> = { off: "끔", dryrun: "드라이런", notify: "알림", propose: "제안" };
  const kpis: KpiTileProps[] = [
    { label: "자율 모드", value: MODE[mode] ?? mode, sub: mode === "off" ? "시스템 설정에서 켜면 10분마다 감시" : "10분 주기 감지 → 판단 → 행동", href: "/admin/settings", accent: mode === "off" ? "data" : "forecast", icon: "Radar", tone: mode === "off" ? "warn" : "default" },
    { label: "조치 필요 (열림)", value: fmtInt(stats.open), sub: `즉시 조치 ${fmtInt(stats.severe)}건`, href: drillHref("/agent", { status: "active" }), accent: "risk", icon: "AlertTriangle", tone: stats.severe > 0 ? "danger" : stats.open > 0 ? "warn" : "default" },
    { label: "발주 제안 승인 대기", value: fmtInt(stats.proposed), sub: `승인 ${fmtInt(stats.accepted)} · 반려 ${fmtInt(stats.dismissed)} (30일)`, href: "/approvals?status=pending", accent: "cycle", icon: "ClipboardCheck", progress: rates.adoption == null ? undefined : { pct: rates.adoption * 100, label: `채택률 ${fmtPct(rates.adoption)}` } },
    { label: "유용함 비율", value: rates.useful == null ? "-" : fmtPct(rates.useful), sub: `유용 ${fmtInt(stats.useful)} · 불필요 ${fmtInt(stats.not_useful)} — 임계값 조정 근거`, href: drillHref("/agent", { status: "resolved" }), accent: "ops", icon: "ThumbsUp" },
  ];
  const tabs = [["active", "진행 중"], ["proposed", "제안"], ["accepted", "승인"], ["dismissed", "반려"], ["resolved", "해소"], ["", "전체"]] as const;
  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">AI 감시</h1><p className="text-sm text-muted-foreground">시스템이 스스로 재고 부족·품절 위험·입고 지연·발주일 임박·수요 급증을 감지하고 판단해 알림·발주 제안을 만듭니다. 발주 반영은 항상 팀장 승인 뒤 (R-AI-10~15). 유용/불필요 피드백은 임계값 조정에 씁니다.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="agent-kpi">{kpis.map(k => <KpiTile key={k.label} {...k} />)}</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {tabs.map(([v, l]) => <Link key={v} href={drillHref("/agent", { status: v || undefined, signal: sp.signal })} className={cn("rounded-full border px-3 py-1", (status === v || (!v && !sp.status)) && status !== "active" || (v === "active" && status === "active") ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{l}</Link>)}
        <span className="mx-2 text-muted-foreground">|</span>
        {stats.by_signal.map(s => <Link key={s.signal} href={drillHref("/agent", { status: sp.status, signal: sp.signal === s.signal ? undefined : s.signal })} className={cn("rounded-full border px-3 py-1", sp.signal === s.signal ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{SIGNAL_LABEL[s.signal] ?? s.signal} {s.n}</Link>)}
      </div>
      <div className="scm-card rounded-xl p-3" style={{ "--acc": "#1baf7a", "--acc-soft": "#e6f6ef" } as React.CSSProperties}><AgentTable rows={rows} /></div>
    </div>
  );
}
