/** 회계연도 헬퍼 (D-015, R-FC-08). 기본 4월 시작 — 실제 값은 app.system_settings.fiscal_year_start_month */
export const DEFAULT_FY_START = 4;
export function fyOf(ym: string, start = DEFAULT_FY_START): number {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m >= start ? y : y - 1;
}
export const fyLabel = (ym: string, start = DEFAULT_FY_START) => `FY${String(fyOf(ym, start)).slice(2)}`;
const pad = (n: number) => String(n).padStart(2, "0");
export function fyRange(fy: number, start = DEFAULT_FY_START): { from: string; to: string } {
  const endM = start === 1 ? 12 : start - 1, endY = start === 1 ? fy : fy + 1;
  return { from: `${fy}-${pad(start)}`, to: `${endY}-${pad(endM)}` };
}
export function fyMonths(fy: number, start = DEFAULT_FY_START): string[] {
  return Array.from({ length: 12 }, (_, i) => { const m = start + i; const y = fy + Math.floor((m - 1) / 12); return `${y}-${pad(((m - 1) % 12) + 1)}`; });
}
