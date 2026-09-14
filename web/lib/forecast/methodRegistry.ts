/** 예측 기법 설정 레지스트리 (R-UI-10, D-053): 비개발자가 JSON 없이 기법 파라미터를 조정하도록 기법별 파라미터 스펙·설명을 한 곳에 둔다.
 *  키는 app.forecast_method.params 의 키와 같다. 여기 없는 파라미터는 화면에서 "고급(개발자 설정)" 으로만 표시하고 편집하지 않는다. */
export type ParamSpec =
  | { kind: "int"; label: string; unit?: string; min: number; max: number; step?: number; help: string }
  | { kind: "number"; label: string; unit?: string; min: number; max: number; step: number; help: string }
  | { kind: "bool"; label: string; help: string; onLabel?: string; offLabel?: string }
  | { kind: "select"; label: string; options: { value: string | number; label: string }[]; help: string };
export const PARAM_LABEL: Record<string, { label: string; unit?: string }> = {
  window: { label: "평균 기간", unit: "개월" }, trend_window: { label: "추세 계산 기간", unit: "개월" }, lags: { label: "과거 참조 기간", unit: "개월" }, n_estimators: { label: "트리 수" }, learning_rate: { label: "학습률" },
  alpha: { label: "평활 계수" }, beta: { label: "추세 계수" }, gamma: { label: "계절 계수" }, season_length: { label: "계절 주기", unit: "개월" }, period: { label: "계절 주기", unit: "개월" }, seasonal: { label: "계절 방식" },
  source: { label: "OL 기준" }, yearly_seasonality: { label: "연간 계절성" }, damped: { label: "추세 감쇠" }, max_depth: { label: "트리 깊이" }, num_leaves: { label: "리프 수" },
};
const alpha: ParamSpec = { kind: "number", label: "평활 계수", min: 0.05, max: 0.5, step: 0.05, help: "클수록 최근 값에 민감(빨리 반응), 작을수록 안정적. 보통 0.1~0.3" };
export const PARAM_SPECS: Record<string, Record<string, ParamSpec>> = {
  baseline6: { window: { kind: "int", label: "평균 기간", unit: "개월", min: 3, max: 12, help: "최근 몇 달의 평균을 그대로 예측값으로 쓸지. 기준선이라 항상 켜져 있음" } },
  ma3: { window: { kind: "int", label: "평균 기간", unit: "개월", min: 2, max: 6, help: "짧을수록 최근 변화를 빨리 따라감" } },
  ma12: { window: { kind: "int", label: "평균 기간", unit: "개월", min: 6, max: 24, help: "길수록 계절·일시 변동에 덜 흔들림" } },
  snaive: { trend_window: { kind: "int", label: "추세 계산 기간", unit: "개월", min: 3, max: 12, help: "작년 같은 달 값에 곱할 최근 추세(증감률)를 몇 달로 계산할지" } },
  ses: {},
  holt: { damped: { kind: "bool", label: "추세 감쇠", help: "켜면 먼 미래로 갈수록 추세를 완만하게 — 과대 예측을 줄임", onLabel: "완만하게", offLabel: "그대로 연장" } },
  hw: { period: { kind: "select", label: "계절 주기", options: [{ value: 12, label: "12개월 (연간)" }, { value: 6, label: "6개월 (반기)" }, { value: 4, label: "4개월" }], help: "같은 패턴이 몇 달마다 반복되는지" },
        seasonal: { kind: "select", label: "계절 방식", options: [{ value: "add", label: "가법 — 계절 변동폭이 일정" }, { value: "mul", label: "승법 — 물량이 커지면 변동폭도 커짐" }], help: "매출 규모가 크게 변하는 품목은 승법" } },
  croston: { alpha }, sba: { alpha },
  arima: { season_length: { kind: "select", label: "계절 주기", options: [{ value: 12, label: "12개월 (연간)" }, { value: 6, label: "6개월" }, { value: 1, label: "계절성 없음" }], help: "자동으로 차수를 고르는 통계 모델. 월 데이터는 12" } },
  prophet: { yearly_seasonality: { kind: "bool", label: "연간 계절성", help: "1년 주기 패턴을 학습할지. 느려서 A 등급만 권장", onLabel: "학습", offLabel: "무시" } },
  lgbm: { lags: { kind: "int", label: "과거 참조 기간", unit: "개월", min: 3, max: 24, help: "예측에 쓸 과거 개월 수" },
          n_estimators: { kind: "int", label: "트리 수", min: 100, max: 2000, step: 100, help: "많을수록 정교하지만 느리고 과적합 위험" },
          learning_rate: { kind: "number", label: "학습률", min: 0.01, max: 0.3, step: 0.01, help: "작을수록 천천히·안정적으로 학습 (트리 수와 함께 조정)" } },
  ol_bias: { source: { kind: "select", label: "OL 기준", options: [{ value: "scm_ol", label: "SCM OL" }, { value: "sales_ol", label: "Sales OL" }], help: "어느 OL 에 과거 편향(과대·과소 비율)을 보정해 기종 예측을 만들지" } },
};
/** 비전문가용 한 줄 설명 */
export const METHOD_INFO: Record<string, { plain: string; when: string }> = {
  baseline6: { plain: "최근 6개월 평균을 그대로 예측값으로. 모든 기법의 비교 기준", when: "항상 후보. 다른 기법이 이보다 못하면 이게 선택됨" },
  ma3: { plain: "최근 3개월 평균", when: "변화를 빨리 따라가야 하는 품목" },
  ma12: { plain: "최근 1년 평균", when: "계절이나 일시 변동에 흔들리지 않게" },
  snaive: { plain: "작년 같은 달 값 × 최근 추세", when: "매년 같은 시기에 오르내리는 품목 (회계연도 4월 기준)" },
  ses: { plain: "최근 값에 더 무게를 둔 가중 평균 (자동 조정)", when: "완만하게 변하는 안정 품목" },
  holt: { plain: "수준 + 추세를 함께 추정", when: "꾸준히 늘거나 줄어드는 품목" },
  hw: { plain: "수준 + 추세 + 계절 패턴", when: "안정적이면서 계절성이 뚜렷한 A·B 등급" },
  croston: { plain: "간헐 수요 전용 — '얼마나 자주' 와 '한 번에 얼마나' 를 따로 추정", when: "0 인 달이 많은 부품" },
  sba: { plain: "Croston 의 과대 편향을 보정한 버전", when: "간헐 수요, 보통 Croston 보다 정확" },
  arima: { plain: "자기상관·차분·계절을 자동으로 찾는 통계 모델", when: "이력이 2년 이상인 안정 품목. 느림" },
  prophet: { plain: "추세 변화점·연간 계절을 학습하는 모델 (Meta)", when: "이력 긴 A 등급. 가장 느림" },
  lgbm: { plain: "전 품목을 한 번에 학습하는 머신러닝(그래디언트 부스팅)", when: "품목이 많고 서로 비슷한 패턴일 때 전체 정확도 향상" },
  ol_bias: { plain: "SCM OL 에 과거 회계연도의 과대·과소 비율을 보정 (기종 전용)", when: "기종 예측. OL 이 늘 30% 정도 많다면 그만큼 깎아 줌" },
};
export const FAMILY_LABEL: Record<string, string> = { simple: "단순 평균", ets: "지수평활", intermittent: "간헐 수요", stat: "통계 모델", ml: "머신러닝", mc: "기종 OL" };
export const LEVEL_LABEL: Record<string, string> = { item: "품목", model: "기종", both: "품목·기종" };
export const PATTERN_SHORT: Record<string, string> = { smooth: "안정", erratic: "불규칙", intermittent: "간헐", lumpy: "간헐·변동", dead: "휴면" };
/** 화면 입력값 → 저장할 params 객체. 스펙에 없는 기존 키는 그대로 보존(고급 설정) */
export function encodeMethodParams(key: string, values: Record<string, unknown>, existing: Record<string, unknown> = {}): { ok: true; params: Record<string, unknown> } | { ok: false; error: string } {
  const specs = PARAM_SPECS[key] ?? {}; const out: Record<string, unknown> = { ...existing };
  for (const [pk, sp] of Object.entries(specs)) {
    const raw = values[pk];
    switch (sp.kind) {
      case "int": { const n = Number(raw); if (!Number.isInteger(n) || n < sp.min || n > sp.max) return { ok: false, error: `${sp.label}: ${sp.min}~${sp.max}${sp.unit ?? ""} 사이 정수` }; out[pk] = n; break; }
      case "number": { const n = Number(raw); if (!Number.isFinite(n) || n < sp.min || n > sp.max) return { ok: false, error: `${sp.label}: ${sp.min}~${sp.max} 사이` }; out[pk] = Math.round(n * 1000) / 1000; break; }
      case "bool": out[pk] = raw === true || raw === "true"; break;
      case "select": { const o = sp.options.find(o => String(o.value) === String(raw)); if (!o) return { ok: false, error: `${sp.label}: 목록에서 선택` }; out[pk] = o.value; break; }
    }
  }
  return { ok: true, params: out };
}
/** 저장된 params → 사람이 읽는 요약 ("평균 기간 6개월 · 추세 감쇠 완만하게") */
export function describeMethodParams(key: string, params: Record<string, unknown> | null | undefined): string {
  const specs = PARAM_SPECS[key] ?? {}; const p = params ?? {};
  const parts = Object.entries(specs).map(([pk, sp]) => { const v = p[pk];
    if (sp.kind === "bool") return `${sp.label} ${v ? (sp.onLabel ?? "켬") : (sp.offLabel ?? "끔")}`;
    if (sp.kind === "select") return `${sp.label} ${sp.options.find(o => String(o.value) === String(v))?.label ?? String(v ?? "-")}`;
    return `${sp.label} ${v ?? "-"}${sp.unit ?? ""}`; });
  const extra = Object.keys(p).filter(k => !(k in specs));
  return [...parts, ...(extra.length ? [`고급 ${extra.length}개`] : [])].join(" · ") || "조정할 설정 없음 (자동 추정)";
}
