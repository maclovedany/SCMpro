/** 시스템 설정 레지스트리 (R-UI-10): 키별 라벨·입력 컨트롤·단위·검증. 화면은 JSON 을 노출하지 않는다. */
export type SettingSpec =
  | { kind: "int"; label: string; unit: string; min: number; max: number; help: string }
  | { kind: "select"; label: string; options: { value: unknown; label: string }[]; help: string }
  | { kind: "days-list"; label: string; help: string }
  | { kind: "flex-table"; label: string; help: string }
  | { kind: "dept-multi"; label: string; help: string }
  | { kind: "text"; label: string; help: string };
export const DEPTS: { value: string; label: string }[] = [{ value: "marketing", label: "마케팅부" }, { value: "sales", label: "영업부" }, { value: "service", label: "서비스부" }, { value: "biz_enable", label: "사업강화부" }];
export const SETTINGS: Record<string, SettingSpec> = {
  ai_model: { kind: "select", label: "AI 모델", options: [{ value: "gpt-5-nano", label: "GPT-5 nano (기본, 빠름·저렴)" }, { value: "gpt-5-mini", label: "GPT-5 mini" }, { value: "gpt-5", label: "GPT-5" }], help: "AI Agent 와 예측 오차 분석에 쓰는 모델" },
  fiscal_year_start_month: { kind: "select", label: "회계연도 시작월", options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` })), help: "연간 집계·전년동월·FY 기준. 4월이면 FY25 = 2025년 4월 ~ 2026년 3월" },
  ol_lead_months: { kind: "int", label: "공급처 OL 제출 선행 기간", unit: "개월", min: 0, max: 12, help: "Flex 범위의 기준이 되는 제출 OL 이 몇 개월 전에 제출되는지" },
  flex_ranges: { kind: "flex-table", label: "Flex 허용 범위", help: "제출 OL 대비 발주량 변경 허용 폭. 리드타임 이후 첫 번째 달부터 순서대로. 표에 없는 달은 제한 없음" },
  dos_avg_months: { kind: "int", label: "DoS 월평균 기간", unit: "개월", min: 1, max: 24, help: "DoS = 월말재고 ÷ 최근 N개월 평균 사용량 × 30" },
  default_lead_time_days: { kind: "int", label: "기본 리드타임", unit: "일", min: 1, max: 365, help: "공급처가 지정되지 않은 품목에 적용" },
  ship_lead_days: { kind: "int", label: "선적 리드타임", unit: "일", min: 0, max: 90, help: "출항일 + 이 일수 = 입고예정일" },
  temp_alloc_days: { kind: "int", label: "임시배정 유효기간", unit: "일", min: 1, max: 365, help: "검토 요청 시점부터. 연장 불가, 지나면 자동 해제" },
  expiry_reminder_days: { kind: "days-list", label: "임시배정 만료 예고 알림", help: "만료 며칠 전에 알릴지. 쉼표로 구분 (예: 10, 5, 3, 2, 1)" },
  reminder_interval_min: { kind: "int", label: "반복 알림 간격", unit: "분", min: 1, max: 1440, help: "승인 대기·미제출 부서에 반복 알림을 보내는 간격" },
  submit_deadline_rule: { kind: "select", label: "수요자료 제출 마감", options: [{ value: "last_day-1", label: "전월 말일의 하루 전" }, { value: "last_day", label: "전월 말일" }], help: "예: 3월 31일이 말일이면 '하루 전' = 3월 30일" },
  submission_depts: { kind: "dept-multi", label: "수요자료 제출 부서", help: "마감 후 미제출이면 반복 알림을 받는 부서" },
  projection_past_months: { kind: "int", label: "재고전개 과거 표시", unit: "개월", min: 1, max: 36, help: "재고전개 그리드에서 과거 몇 개월을 보여줄지" },
  projection_future_months: { kind: "int", label: "재고전개 미래 표시 (예측 지평선)", unit: "개월", min: 1, max: 24, help: "프로덕션 예측·발주 계획이 앞으로 몇 개월을 다룰지" },
};
export const SETTING_ORDER = ["fiscal_year_start_month", "ol_lead_months", "flex_ranges", "dos_avg_months", "default_lead_time_days", "ship_lead_days", "temp_alloc_days", "expiry_reminder_days", "reminder_interval_min", "submit_deadline_rule", "submission_depts", "projection_past_months", "projection_future_months", "ai_model"];
export type Flex = { offset: number; pct: number };
/** 화면 값 → 저장 JSON 문자열. 오류면 메시지 */
export function encodeSetting(key: string, value: unknown): { ok: true; json: string } | { ok: false; error: string } {
  const spec = SETTINGS[key];
  if (!spec) return { ok: true, json: typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) };
  switch (spec.kind) {
    case "int": { const n = Number(value); if (!Number.isInteger(n) || n < spec.min || n > spec.max) return { ok: false, error: `${spec.label}: ${spec.min}~${spec.max} ${spec.unit} 사이 정수` }; return { ok: true, json: String(n) }; }
    case "select": { const o = spec.options.find(o => String(o.value) === String(value)); if (!o) return { ok: false, error: `${spec.label}: 목록에서 선택` }; return { ok: true, json: JSON.stringify(o.value) }; }
    case "days-list": { const arr = String(value).split(/[,\s]+/).filter(Boolean).map(Number); if (!arr.length || arr.some(n => !Number.isInteger(n) || n < 1 || n > 365)) return { ok: false, error: `${spec.label}: 1~365 사이 정수를 쉼표로` }; return { ok: true, json: JSON.stringify([...new Set(arr)].sort((a, b) => b - a)) }; }
    case "flex-table": { const rows = value as Flex[]; if (!Array.isArray(rows) || rows.some(r => !Number.isInteger(r.offset) || r.offset < 1 || !(r.pct >= 0 && r.pct <= 100))) return { ok: false, error: "Flex: 순서는 1 이상 정수, 허용 폭은 0~100%" }; const offs = rows.map(r => r.offset); if (new Set(offs).size !== offs.length) return { ok: false, error: "Flex: 같은 순서가 중복됨" }; return { ok: true, json: JSON.stringify([...rows].sort((a, b) => a.offset - b.offset).map(r => ({ offset: r.offset, pct: r.pct }))) }; }
    case "dept-multi": { const arr = value as string[]; if (!Array.isArray(arr) || arr.length === 0) return { ok: false, error: "부서를 하나 이상 선택" }; return { ok: true, json: JSON.stringify(arr) }; }
    default: return { ok: true, json: JSON.stringify(String(value)) };
  }
}
/** 저장 JSON → 사람이 읽는 요약 */
export function describeSetting(key: string, value: unknown): string {
  const spec = SETTINGS[key]; if (!spec) return JSON.stringify(value);
  switch (spec.kind) {
    case "int": return `${value} ${spec.unit}`;
    case "select": return spec.options.find(o => String(o.value) === String(value))?.label ?? String(value);
    case "days-list": return (value as number[]).map(d => `${d}일 전`).join(", ");
    case "flex-table": return (value as Flex[]).map(r => `${r.offset}번째 달 ±${r.pct}%`).join(", ") + " · 이후 제한 없음";
    case "dept-multi": return (value as string[]).map(v => DEPTS.find(d => d.value === v)?.label ?? v).join(", ");
    default: return String(value);
  }
}
