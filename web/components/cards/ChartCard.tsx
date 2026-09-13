import Link from "next/link";
import { ACCENT, type AccentKey } from "@/lib/design/palette";
/** 차트 카드 (R-UI-13): 제목 + 한 줄 해석(insight) + 차트 + 근거 링크 */
export function ChartCard({ title, insight, href, accent, children }: { title: string; insight?: string; href?: string; accent: AccentKey; children: React.ReactNode }) {
  const a = ACCENT[accent];
  return (
    <div className="flex h-full flex-col rounded-xl border bg-background p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><span className="inline-block h-3.5 w-1 rounded-full" style={{ background: a.hex }} />{title}</div>{insight && <div className="mt-0.5 text-xs text-muted-foreground">{insight}</div>}</div>
        {href && <Link href={href} className="shrink-0 text-xs text-muted-foreground hover:underline">자세히 →</Link>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
