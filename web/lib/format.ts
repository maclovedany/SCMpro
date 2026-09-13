export const fmtInt = (n: number | null | undefined) => n == null ? "-" : Math.round(n).toLocaleString("ko-KR");
export const fmtNum = (n: number | null | undefined, d = 1) => n == null ? "-" : n.toLocaleString("ko-KR", { maximumFractionDigits: d });
export const fmtPct = (x: number | null | undefined) => x == null ? "-" : `${(x * 100).toFixed(1)}%`;
export const fmtYm = (ym: string) => ym.slice(2);
export const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10) : "-";
export const fmtDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-";
