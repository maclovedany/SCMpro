import { createServerSupabase } from "@/lib/supabase/server";
import { fetchExtraDemand } from "@/lib/queries/orders";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtDateTime } from "@/lib/format";
import { ExtraDemandForm } from "./ExtraDemandForm";
const KIND: Record<string, string> = { confirmed_order: "수주 확정", meeting_approval: "수급회의 승인", bulkdeal: "Bulkdeal" };
export default async function ExtraDemandPage() {
  const rows = await fetchExtraDemand(await createServerSupabase());
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">추가 수요</h1><p className="text-sm text-muted-foreground">① 수주 확정(주문번호 필수, 자동 반영) ② 수급회의 승인(SCM 입력) ③ Bulkdeal(고객·기종·수량·사유, 주문번호 선택, SCM팀장 승인) — R-OQ-20~26. 영업 확률만 높은 건은 등록하지 않습니다. 같은 거래를 Bulkdeal 과 수주확정으로 중복 등록하면 경고가 뜹니다.</p></div>
      <ExtraDemandForm />
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">종류</th><th>품목</th><th>필요월</th><th className="text-right">수량</th><th>주문번호</th><th>고객 · 기종</th><th>상태</th><th>등록</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t"><td className="py-1"><Badge variant="outline">{KIND[r.kind] ?? r.kind}</Badge></td><td className="font-mono">{r.item_code}</td><td>{r.need_ym}</td><td className="text-right tabular-nums">{fmtInt(Number(r.qty))}</td><td className="whitespace-nowrap font-mono text-xs">{r.order_no || "-"}</td><td className="whitespace-nowrap text-xs">{[r.customer, r.model_base].filter(Boolean).join(" · ") || "-"}</td><td><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></td><td className="text-xs">{fmtDateTime(r.created_at)}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">없음</td></tr>}</tbody></table>
    </div>
  );
}
