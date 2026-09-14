/** AI 조정 제안을 사람 말로 (D-052, R-UI-10): 기법 키·파라미터 키·JSON 대신 라벨·"현재 → 제안"·퍼센트 */
import { METHOD_LABEL } from "@/lib/queries/forecast";
export const PARAM_LABEL: Record<string, { label: string; unit?: string }> = {
  window: { label: "평균 기간", unit: "개월" }, lags: { label: "과거 참조 기간", unit: "개월" }, n_estimators: { label: "트리 수" }, learning_rate: { label: "학습률" },
  alpha: { label: "평활 계수" }, beta: { label: "추세 계수" }, gamma: { label: "계절 계수" }, season_length: { label: "계절 주기", unit: "개월" }, period: { label: "계절 주기", unit: "개월" },
  source: { label: "OL 기준" }, yearly_seasonality: { label: "연간 계절성" }, damped: { label: "추세 감쇠" }, max_depth: { label: "트리 깊이" }, num_leaves: { label: "리프 수" },
};
const KEY_LABEL: Record<string, string> = {
  scm_ol_bias: "SCM OL Bias", scm_ol_wape: "SCM OL WAPE", sales_ol_bias: "Sales OL Bias", sales_ol_wape: "Sales OL WAPE", item_wape: "품목 WAPE", item_bias: "품목 Bias",
  model_wape: "기종 WAPE", model_bias: "기종 Bias", item_scm_ol_n: "제출 OL 채점 월수", champion_share: "챔피언 비중", worst_items: "오차 상위 품목", baseline6: "6M 평균", n_items: "품목 수",
  wape: "WAPE", bias: "Bias", mape: "MAPE",
};
const fmtVal = (v: unknown, unit?: string) => (v == null ? "-" : typeof v === "boolean" ? (v ? "켬" : "끔") : typeof v === "number" ? `${Number.isInteger(v) ? v : Math.round(v * 1000) / 1000}${unit ?? ""}` : String(v));
/** `{window: 12}` → "평균 기간 9개월 → 12개월" (현재값이 있으면 화살표) */
export function describePatch(patch: Record<string, unknown> | null | undefined, current?: Record<string, unknown> | null): string {
  if (!patch || !Object.keys(patch).length) return "";
  return Object.entries(patch).map(([k, v]) => { const m = PARAM_LABEL[k] ?? { label: k }; const cur = current?.[k];
    return cur != null && cur !== v ? `${m.label} ${fmtVal(cur, m.unit)} → ${fmtVal(v, m.unit)}` : `${m.label} ${fmtVal(v, m.unit)}`; }).join(", ");
}
/** 제안 한 줄: "이동평균 12M: 평균 기간 9개월 → 12개월 (전체)" */
export function describeProposal(p: { method_key: string; param_patch?: Record<string, unknown> | null; enabled?: boolean | null; scope?: string }, current?: Record<string, unknown> | null): string {
  const parts: string[] = [];
  const patch = describePatch(p.param_patch, current); if (patch) parts.push(patch);
  if (p.enabled != null) parts.push(p.enabled ? "기법 켬" : "기법 끔");
  const scope = p.scope && !["global", "all", "전체"].includes(p.scope) ? ` (${p.scope})` : "";
  return `${METHOD_LABEL[p.method_key] ?? p.method_key}: ${parts.join(" · ") || "변경 없음"}${scope}`;
}
/** LLM 이 남긴 키 이름·소수를 사람 말로: scm_ol_bias → SCM OL Bias, 0.3644 → 36.4% (0~1 사이 소수만), `(key: v, key2: v)` 괄호 블록 정리 */
export function humanize(text: string | null | undefined): string {
  if (!text) return "";
  let t = text;
  t = t.replace(/\(([a-z0-9_.]+:\s*[^()]*)\)/g, (_m, inner: string) => "(" + inner.split(/,\s*/).map(seg => { const mm = /^([a-z_0-9.]+)\s*:\s*(.*)$/.exec(seg.trim()); if (!mm) return seg;
    const dm = /^methods\.([a-z0-9_]+)\.params\.([a-z_]+)$/.exec(mm[1]); const label = dm ? `${METHOD_LABEL[dm[1]] ?? dm[1]}의 ${PARAM_LABEL[dm[2]]?.label ?? dm[2]}` : (KEY_LABEL[mm[1]] ?? mm[1].replace(/_/g, " "));
    return `${label} ${pct(mm[2])}`; }).join(", ") + ")");
  t = t.replace(/\b(scm_ol_bias|scm_ol_wape|sales_ol_bias|sales_ol_wape|item_wape|item_bias|model_wape|model_bias|item_scm_ol_n|champion_share|worst_items|n_items)\b/g, k => KEY_LABEL[k] ?? k);
  t = t.replace(/\bmethods\.([a-z0-9_]+)\.params\.([a-z_]+)\b/g, (_m, mk: string, pk: string) => `${METHOD_LABEL[mk] ?? mk}의 ${PARAM_LABEL[pk]?.label ?? pk}`);
  t = t.replace(/\b(ma3|ma12|snaive|ses|holt|hw|croston|sba|arima|prophet|lgbm|ol_bias|baseline6)\b(?=[의\s,.)])/g, k => METHOD_LABEL[k] ?? k);
  return t;
}
const pct = (v: string) => { const n = Number(v.replace(/[,\s]/g, "")); if (!Number.isFinite(n)) return v; if (Math.abs(n) < 1 && v.includes(".")) return `${Math.round(n * 1000) / 10}%`; return v; };
export const PROPOSAL_STATUS: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "분석 대기 (10분 내 처리)", tone: "outline" }, pending: { label: "검토 대기", tone: "secondary" }, requested: { label: "팀장 승인 요청됨", tone: "secondary" },
  applied: { label: "적용됨", tone: "default" }, rejected: { label: "반려", tone: "destructive" }, failed: { label: "분석 실패", tone: "destructive" },
};
