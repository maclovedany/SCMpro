import * as XLSX from "xlsx";
/** xlsx/csv 첫 시트 → 헤더 + 문자열 행. 날짜 셀은 YYYY-MM-DD */
export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  // CSV 는 UTF-8 텍스트로 읽는다 (array 로 읽으면 한글 헤더가 깨짐). BOM 제거.
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const wb = isCsv
    ? XLSX.read((await file.text()).replace(/^\uFEFF/, ""), { type: "string", cellDates: true, raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = (aoa[0] as unknown[]).map(h => String(h ?? "").trim());
  // 날짜 셀은 로컬 날짜로 (toISOString 은 UTC 변환으로 KST 자정이 전날이 됨). "2026-07" 같은 월 문자열도 SheetJS 가 Date 로 읽으므로 validate 의 toYm 이 YYYY-MM-DD 를 받아준다
  const fmt = (v: unknown) => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v ?? "").trim();
  const rows = aoa.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, fmt((r as unknown[])[i])]))).filter(r => Object.values(r).some(v => v !== ""));
  return { headers, rows };
}
