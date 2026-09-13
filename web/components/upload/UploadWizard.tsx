"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyUpload, type ApplyResult } from "@/app/(app)/upload/actions";
import { parseFile } from "@/lib/upload/parse";
import { autoMap, normalizeRows, type RowError } from "@/lib/upload/validate";
import { UPLOAD_TARGETS, TARGET_KEYS, templateCsv, type TargetKey } from "@/lib/upload/templates";
import { ColumnMapper } from "./ColumnMapper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
type Step = 1 | 2 | 3 | 4;
function downloadCsv(name: string, content: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
export function UploadWizard({ initialTarget }: { initialTarget?: string }) {
  const [target, setTarget] = useState<TargetKey>((initialTarget && initialTarget in UPLOAD_TARGETS ? initialTarget : "inventory_snapshot") as TargetKey);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({});
  const [errorFilter, setErrorFilter] = useState<"all" | "errors">("all");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [pending, start] = useTransition();
  const def = UPLOAD_TARGETS[target];
  const validated = useMemo(() => (step >= 3 && parsed ? normalizeRows(parsed.rows, mapping, target) : null), [step, parsed, mapping, target]);
  const onFile = async (f: File | null) => {
    if (!f) return; setFile(f);
    try { const p = await parseFile(f); setParsed(p); setMapping(autoMap(p.headers, target)); setStep(2); }
    catch (e) { toast.error(`파일을 읽을 수 없습니다: ${String(e)}`); }
  };
  const missingRequired = def.columns.filter(c => c.required && !mapping[c.key]).map(c => c.label);
  const apply = () => validated && start(async () => {
    const r = await applyUpload(target, validated.rows, file?.name ?? "upload");
    setResult(r); setStep(4);
    if (r.ok) toast.success(`반영 완료: 성공 ${r.ok_count} / 오류 ${r.error_count}`); else toast.error(r.error);
  });
  const errorCsv = (errs: RowError[]) => downloadCsv(`errors-${target}.csv`, "﻿행,오류\n" + errs.map(e => `${e.row},"${e.message.replace(/"/g, '""')}"`).join("\n"));
  const reset = () => { setStep(1); setFile(null); setParsed(null); setMapping({}); setResult(null); };
  return (
    <div className="space-y-4">
      <ol className="flex gap-2 text-sm">{["대상·파일", "컬럼 매핑", "검증", "반영"].map((l, i) => <li key={l} className={cn("rounded-full border px-3 py-1", step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-muted" : "text-muted-foreground")}>{i + 1}. {l}</li>)}</ol>
      {step === 1 && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">대상<br /><select name="target" className="mt-1 h-9 rounded-md border bg-background px-2" value={target} onChange={e => setTarget(e.target.value as TargetKey)}>
              {TARGET_KEYS.map(k => <option key={k} value={k}>{UPLOAD_TARGETS[k].label}</option>)}</select></label>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(`template-${target}.csv`, templateCsv(target))}>템플릿 다운로드</Button>
          </div>
          <p className="text-sm text-muted-foreground">{def.description} · 필수: {def.columns.filter(c => c.required).map(c => c.label).join(", ")} · 모드: {def.mode === "replace" ? "같은 기준일 교체" : "upsert"}</p>
          <label className="block cursor-pointer rounded-md border-2 border-dashed p-8 text-center text-sm hover:bg-muted/30"
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0] ?? null); }}>
            {file ? file.name : "xlsx / csv 파일을 끌어다 놓거나 클릭해서 선택"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </label>
        </Card>
      )}
      {step === 2 && parsed && (
        <Card className="space-y-4 p-4">
          <div className="text-sm">{file?.name} · {fmtInt(parsed.rows.length)}행 · 헤더 {parsed.headers.length}개</div>
          <ColumnMapper target={target} headers={parsed.headers} mapping={mapping} onChange={setMapping} preview={parsed.rows} />
          {missingRequired.length > 0 && <p className="text-sm text-red-600">필수 컬럼 미매핑: {missingRequired.join(", ")}</p>}
          <div className="flex gap-2"><Button variant="outline" onClick={reset}>처음으로</Button><Button onClick={() => setStep(3)} disabled={missingRequired.length > 0}>검증</Button></div>
        </Card>
      )}
      {step === 3 && validated && (
        <Card className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setErrorFilter("all")} className={cn("rounded-md border p-3 text-left", errorFilter === "all" && "border-primary")}><div className="text-sm text-muted-foreground">정상</div><div className="text-2xl font-semibold">정상 {fmtInt(validated.rows.length)}건</div></button>
            <button type="button" onClick={() => setErrorFilter("errors")} className={cn("rounded-md border p-3 text-left", validated.errors.length > 0 && "border-red-300 bg-red-50/40", errorFilter === "errors" && "border-primary")}><div className="text-sm text-muted-foreground">오류 (제외됨)</div><div className="text-2xl font-semibold">오류 {fmtInt(validated.errors.length)}건</div></button>
          </div>
          {errorFilter === "errors" && validated.errors.length > 0 && (
            <div><ul className="max-h-60 overflow-auto rounded-md border p-2 text-xs">{validated.errors.map(e => <li key={e.row}>행 {e.row}: {e.message}</li>)}</ul>
              <Button variant="link" size="sm" onClick={() => errorCsv(validated.errors)}>오류 CSV 다운로드</Button></div>)}
          <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(2)}>매핑 수정</Button><Button onClick={apply} disabled={pending || validated.rows.length === 0}>{pending ? "반영 중…" : "반영"}</Button></div>
        </Card>
      )}
      {step === 4 && result && (
        <Card className="space-y-3 p-4" data-testid="upload-result">
          {result.ok ? (<>
            <div className="text-lg font-semibold">반영 완료</div>
            <div className="flex gap-2"><Badge>성공 {fmtInt(result.ok_count)}</Badge>{result.error_count > 0 && <Badge variant="destructive">서버 오류 {fmtInt(result.error_count)}</Badge>}</div>
            {result.errors.length > 0 && <div><ul className="max-h-60 overflow-auto rounded-md border p-2 text-xs">{result.errors.map(e => <li key={e.row}>행 {e.row}: {e.message}</li>)}</ul><Button variant="link" size="sm" onClick={() => errorCsv(result.errors)}>오류 CSV 다운로드</Button></div>}
            <a className="text-sm underline" href="/upload?tab=log">업로드 이력 보기</a>
          </>) : <div className="text-red-600">{result.error}</div>}
          <div><Button variant="outline" onClick={reset}>새 업로드</Button></div>
        </Card>
      )}
    </div>
  );
}
