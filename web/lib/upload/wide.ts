/** 넓은 형식(월이 열로 늘어선 회사 파일) → 긴 형식(품목코드·월·수량) 변환. 출고 실적 추가 업로드용 (D-030) */
const MONTH_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d{2})[-./](\d{4})$/, m => `${m[2]}-${m[1]}`],                       // 07-2026 (회사 부품 파일)
  [/^(\d{4})[-./](\d{1,2})$/, m => `${m[1]}-${m[2].padStart(2, "0")}`],   // 2026-07, 2026.7
  [/^(\d{4})(\d{2})$/, m => `${m[1]}-${m[2]}`],                            // 202607
  [/^(\d{4})년\s*(\d{1,2})월$/, m => `${m[1]}-${m[2].padStart(2, "0")}`],  // 2026년 7월
  [/^(\d{2})년\s*(\d{1,2})월$/, m => `20${m[1]}-${m[2].padStart(2, "0")}`],// 26년 7월
];
export function headerToYm(h: string): string | null {
  const t = h.trim();
  for (const [re, fn] of MONTH_PATTERNS) { const m = t.match(re); if (m) { const ym = fn(m); const mm = Number(ym.slice(5)); if (mm >= 1 && mm <= 12) return ym; } }
  return null;
}
const ITEM_HEADERS = ["item", "item_code", "품목", "품목코드", "코드", "code", "part", "hoc"];
export type WideInfo = { itemCol: string; monthCols: { header: string; ym: string }[]; otherCols: string[] };
/** 월 열이 6개 이상이면 넓은 형식으로 본다 */
export function detectWide(headers: string[]): WideInfo | null {
  const monthCols = headers.map(h => ({ header: h, ym: headerToYm(h) })).filter((x): x is { header: string; ym: string } => !!x.ym);
  if (monthCols.length < 6) return null;
  const rest = headers.filter(h => !monthCols.some(m => m.header === h));
  const itemCol = rest.find(h => ITEM_HEADERS.includes(h.trim().toLowerCase())) ?? rest.find(h => /item|code|품목|코드/i.test(h)) ?? rest[0];
  if (!itemCol) return null;
  return { itemCol, monthCols: monthCols.sort((a, b) => a.ym.localeCompare(b.ym)), otherCols: rest.filter(h => h !== itemCol) };
}
/** 긴 형식 행으로 변환. 빈 칸·0 은 제외(희소 저장), 숫자 아닌 값은 오류로 보고 */
export function wideToLong(rows: Record<string, string>[], info: WideInfo, itemType: string, opts: { yms?: string[] } = {}) {
  const out: { item_code: string; ym: string; qty: number; item_type: string }[] = []; const errors: { row: number; message: string }[] = [];
  const allow = opts.yms ? new Set(opts.yms) : null;
  rows.forEach((r, i) => {
    const code = String(r[info.itemCol] ?? "").trim(); if (!code) { errors.push({ row: i + 1, message: "품목코드 없음" }); return; }
    for (const m of info.monthCols) {
      if (allow && !allow.has(m.ym)) continue;
      const raw = String(r[m.header] ?? "").trim(); if (!raw) continue;
      const n = Number(raw.replace(/,/g, "")); if (isNaN(n)) { errors.push({ row: i + 1, message: `${m.header} 숫자 아님: ${raw}` }); continue; }
      if (n === 0) continue;
      out.push({ item_code: code, ym: m.ym, qty: n, item_type: itemType });
    }
  });
  return { rows: out, errors };
}
