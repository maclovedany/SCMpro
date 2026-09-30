/** 업무 날짜 = 한국 시간 (D-082). 서버(Vercel · Railway)는 UTC 라 그대로 쓰면 오전 9시 전에는 하루 전 날짜·이전 달이 나온다.
 *  DB 도 시간대가 Asia/Seoul 이라 current_date 와 같은 날짜가 된다. */
const KST_MS = 9 * 3600 * 1000;
const kst = (d: Date) => new Date(d.getTime() + KST_MS);      // UTC 필드로 읽으면 한국 시각
/** 오늘 YYYY-MM-DD */
export const todayKst = (d = new Date()) => kst(d).toISOString().slice(0, 10);
/** 이번 달 YYYY-MM */
export const thisYmKst = (d = new Date()) => kst(d).toISOString().slice(0, 7);
/** 다음 달 YYYY-MM */
export function nextYmKst(d = new Date()) { const k = kst(d); const y = k.getUTCFullYear(), m = k.getUTCMonth() + 2; return `${y + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}`; }
export const yearKst = (d = new Date()) => kst(d).getUTCFullYear();
/** 오늘까지 n일의 날짜 목록 (오래된 날부터) */
export const daysBackKst = (n: number, d = new Date()) => Array.from({ length: n }, (_, i) => todayKst(new Date(d.getTime() - (n - 1 - i) * 86400e3)));
