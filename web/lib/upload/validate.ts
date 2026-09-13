import { UPLOAD_TARGETS, type TargetKey } from "./templates";
const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, "");
/** 헤더 자동 매핑: 키 또는 한국어 라벨과 동일(공백·기호 무시) */
export function autoMap(headers: string[], target: TargetKey): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const c of UPLOAD_TARGETS[target].columns) out[c.key] = headers.find(h => norm(h) === norm(c.key) || norm(h) === norm(c.label));
  return out;
}
const DATE = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/, YM = /^(\d{4})[-./](\d{1,2})$/;
const toDate = (s: string) => { const m = DATE.exec(s); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null; };
const toYm = (s: string) => { const m = YM.exec(s); return m ? `${m[1]}-${m[2].padStart(2, "0")}` : null; };
const toNum = (s: string) => { const n = Number(s.replace(/,/g, "")); return isNaN(n) ? null : n; };
export type RowError = { row: number; message: string };
/** 타입 변환·필수·enum 검사. 오류 행은 제외하고 errors 에 기록 (행 번호 1-base) */
export function normalizeRows(rows: Record<string, string>[], mapping: Record<string, string | undefined>, target: TargetKey): { rows: Record<string, unknown>[]; errors: RowError[] } {
  const cols = UPLOAD_TARGETS[target].columns; const out: Record<string, unknown>[] = []; const errors: RowError[] = [];
  rows.forEach((r, i) => {
    const o: Record<string, unknown> = {}; const errs: string[] = [];
    for (const c of cols) {
      const h = mapping[c.key]; const raw = h ? String(r[h] ?? "").trim() : "";
      if (!raw) { if (c.required) errs.push(`${c.label} 필수`); continue; }
      switch (c.type) {
        case "int": { const n = toNum(raw); if (n === null || !Number.isInteger(n)) errs.push(`${c.label} 정수 아님: ${raw}`); else o[c.key] = n; break; }
        case "number": { const n = toNum(raw); if (n === null) errs.push(`${c.label} 숫자 아님: ${raw}`); else o[c.key] = n; break; }
        case "date": { const d = toDate(raw); if (!d) errs.push(`${c.label} 날짜 형식(YYYY-MM-DD) 아님: ${raw}`); else o[c.key] = d; break; }
        case "ym": { const d = toYm(raw); if (!d) errs.push(`${c.label} 월 형식(YYYY-MM) 아님: ${raw}`); else o[c.key] = d; break; }
        case "enum": { if (!c.enum!.includes(raw)) errs.push(`${c.label} 허용값 아님: ${raw} (${c.enum!.join("/")})`); else o[c.key] = raw; break; }
        default: o[c.key] = raw;
      }
    }
    if (errs.length) errors.push({ row: i + 1, message: errs.join("; ") }); else out.push(o);
  });
  return { rows: out, errors };
}
