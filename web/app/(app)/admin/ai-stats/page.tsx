import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getProfile } from "@/lib/auth/getProfile";
import { DrillCard } from "@/components/cards/DrillCard";
import { Badge } from "@/components/ui/badge";
import { drillHref } from "@/lib/drill";
import { fmtInt, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
type Stats = { total: number; today: number; users: number; errors: number; topics: { topic: string; n: number }[]; daily: { day: string; n: number }[]; top_users: { name: string; n: number }[] };
export default async function AiStatsPage({ searchParams }: { searchParams: Promise<{ topic?: string; days?: string; role?: string }> }) {
  const p = await getProfile(); if (p?.role !== "admin") redirect("/dashboard");
  const sp = await searchParams; const days = Number(sp.days ?? 30) || 30;
  const sb = await createServerSupabase();
  await headers(); const since = new Date(new Date().getTime() - days * 86400e3).toISOString();
  const { data } = await sb.schema("app").rpc("fn_ai_stats", { p_days: days }); const s = data as unknown as Stats;
  let q = sb.schema("analytics").from("v_ai_message_log").select("*").eq("role", "user").gte("created_at", since).order("created_at", { ascending: false }).limit(200);
  if (sp.topic) q = q.eq("topic", sp.topic);
  const { data: rows } = await q;
  const base = "/admin/ai-stats";
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">AI 질문 통계</h1><p className="text-sm text-muted-foreground">사용자들이 주로 무엇을 묻는지 — 주제·일별·사용자별 (R-AI-06). 카드 클릭 시 해당 질문 목록.</p></div>
      <div className="flex gap-2 text-sm">{[7, 30, 90].map(d => <Link key={d} href={drillHref(base, { days: d, topic: sp.topic })} className={cn("rounded-full border px-3 py-1", d === days ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{d}일</Link>)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillCard label={`질문 (${days}일)`} value={fmtInt(s.total)} hint={`오늘 ${fmtInt(s.today)}`} href={drillHref(base, { days })} />
        <DrillCard label="활성 사용자" value={fmtInt(s.users)} hint={s.top_users[0] ? `최다 ${s.top_users[0].name} ${s.top_users[0].n}건` : ""} href={drillHref(base, { days })} />
        <DrillCard label="상위 주제" value={s.topics[0]?.topic ?? "-"} hint={s.topics.slice(0, 3).map(t => `${t.topic} ${t.n}`).join(" · ")} href={drillHref(base, { days, topic: s.topics[0]?.topic })} />
        <DrillCard label="답변 실패" value={fmtInt(s.errors)} hint="AI 호출 오류" href={drillHref(base, { days })} tone={s.errors ? "warn" : "default"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">주제별</h2><ul className="space-y-1 text-sm">{s.topics.map(t => <li key={t.topic} className="flex items-center gap-2"><Link href={drillHref(base, { days, topic: t.topic })} className="w-16 hover:underline">{t.topic}</Link><div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-blue-500" style={{ width: `${Math.round(100 * t.n / Math.max(1, s.total))}%` }} /></div><span className="w-10 text-right tabular-nums">{t.n}</span></li>)}</ul></section>
        <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">일별</h2><ul className="text-sm">{s.daily.slice(-14).map(d => <li key={d.day} className="flex justify-between border-t py-0.5"><span>{d.day}</span><span className="tabular-nums">{d.n}</span></li>)}</ul></section>
        <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-medium">사용자별</h2><ul className="text-sm">{s.top_users.map(u => <li key={u.name} className="flex justify-between border-t py-0.5"><span>{u.name}</span><span className="tabular-nums">{u.n}</span></li>)}</ul></section>
      </div>
      <section><h2 className="mb-2 text-sm font-medium">질문 목록 {sp.topic && <Badge>{sp.topic}</Badge>}</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-1">시각</th><th>사용자</th><th>주제</th><th>질문</th><th>화면</th></tr></thead>
          <tbody>{(rows ?? []).map(r => <tr key={r.id} className="border-t" data-testid="ai-log-row"><td className="py-1 text-xs">{fmtDateTime(r.created_at)}</td><td>{r.user_name} <span className="text-xs text-muted-foreground">{r.user_role}</span></td><td><Badge variant="outline">{r.topic ?? "기타"}</Badge></td><td className="max-w-xl truncate">{r.content}</td><td className="text-xs text-muted-foreground">{r.page_context}</td></tr>)}
          {(rows ?? []).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">질문 없음</td></tr>}</tbody></table></section>
    </div>
  );
}
