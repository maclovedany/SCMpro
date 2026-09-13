"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
/** 서버 오류를 raw 객체 대신 읽을 수 있는 메시지로. Supabase 오류는 code/message 를 그대로 노출 */
export default function AppError({ error, reset }: { error: Error & { digest?: string; code?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  let msg = error.message;
  try { const o = JSON.parse(msg); if (o && typeof o === "object") msg = `[${o.code ?? "-"}] ${o.message ?? msg}${o.hint ? ` (힌트: ${o.hint})` : ""}`; } catch {}
  const clock = /issued at future|PGRST303/.test(msg);
  return (
    <div className="mx-auto mt-16 max-w-xl space-y-3 rounded-md border p-6">
      <h1 className="text-lg font-semibold">화면을 불러오지 못했습니다</h1>
      <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{msg}{error.digest ? `\n(digest ${error.digest})` : ""}</pre>
      {clock && <p className="text-sm text-muted-foreground">로그인 직후 인증 토큰 시각과 서버 시각의 차이로 생기는 일시 오류입니다. 몇 초 후 다시 시도하면 됩니다.</p>}
      <div className="flex gap-2"><Button onClick={reset}>다시 시도</Button><Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>대시보드로</Button></div>
    </div>
  );
}
