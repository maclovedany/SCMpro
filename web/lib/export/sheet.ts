import * as XLSX from "xlsx";

/** 표 내보내기 공통 — CSV / Excel(xlsx). R-UI-05, D-055 */
export type ExportFormat = "csv" | "xlsx";
export type Cell = string | number;

export const FORMAT_LABEL: Record<ExportFormat, string> = { csv: "CSV", xlsx: "Excel (.xlsx)" };

/** 엑셀이 UTF-8 한글을 깨지 않고 열게 하는 BOM */
const BOM = String.fromCharCode(0xfeff);

/** 화면 값 → 셀. 숫자는 숫자로 남겨 엑셀에서 합계가 되게 한다. 그 외는 문자열, 빈 값은 "" */
export function normalizeCell(v: unknown): Cell {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return String(v);
}

/** RFC 4180: 따옴표는 두 번 겹쳐 escape. 숫자는 따옴표 없이 — 엑셀이 텍스트로 읽지 않도록 */
const csvCell = (v: Cell) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers.map(h => csvCell(h)), ...rows.map(r => r.map(csvCell))].map(r => r.join(",")).join("\n");
}

/** 엑셀 시트 이름 제약: 1~31자, [ ] : * ? / \ 금지 */
export function sheetNameOf(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
  return cleaned || "Sheet1";
}

/** 한글 등 비 Latin-1 문자는 폭을 2로 쳐서 열 너비를 잡는다 (헤더 잘림 방지, R-UI-09 취지) */
const displayWidth = (v: Cell) => String(v).replace(/[^\x00-\xff]/g, "..").length;

export function toWorkbook(headers: string[], rows: Cell[][], sheetName: string): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(60, Math.max(6, displayWidth(h), ...rows.map(r => displayWidth(r[i] ?? "")))) + 2,
  }));
  ws["!freeze"] = { xSplit: "0", ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetNameOf(sheetName));
  return wb;
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 파일명(확장자 제외) + 헤더 + 행 → 다운로드. sheetName 기본값은 파일명 */
export function exportRows(name: string, headers: string[], rows: Cell[][], format: ExportFormat, sheetName = name) {
  if (format === "csv") {
    saveBlob(new Blob([BOM + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
    return;
  }
  const buf = XLSX.write(toWorkbook(headers, rows, sheetName), { type: "array", bookType: "xlsx" });
  saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
}
