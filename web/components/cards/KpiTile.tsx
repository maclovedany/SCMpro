import Link from "next/link";
import * as Icons from "lucide-react";
import { ACCENT, type AccentKey } from "@/lib/design/palette";
import { cn } from "@/lib/utils";
export type KpiTileProps = { label: string; value: string; sub?: string; delta?: { text: string; dir: "up" | "down" | "flat"; good?: boolean }; progress?: { pct: number; label?: string }; href: string; accent: AccentKey; icon: string; tone?: "default" | "warn" | "danger" };
/** 상단 KPI 타일 (D-032, R-UI-13): 아이콘 타일 + 큰 숫자 + 전월 대비 + 진행바. 전부 드릴다운 */
export function KpiTile({ label, value, sub, delta, progress, href, accent, icon, tone = "default" }: KpiTileProps) {
  const a = ACCENT[accent]; const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[icon] ?? Icons.Circle;
  const deltaColor = delta ? (delta.dir === "flat" ? "text-muted-foreground" : delta.good ? "text-[#0ca30c]" : "text-[#d03b3b]") : "";
  return (
    <Link href={href} prefetch aria-label={`${label} 상세 보기`} className={cn("group flex h-full min-h-[6.5rem] items-stretch gap-3 rounded-xl border bg-background p-3 transition hover:shadow-md", tone === "danger" && "border-[#d03b3b]/50", tone === "warn" && "border-[#fab219]/60")}>
      <div className="flex w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: a.soft }}><Icon className="h-6 w-6" style={{ color: a.hex }} /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-2xl font-semibold tabular-nums" title={value}>{value}</div>
        {delta && <div className={cn("truncate text-[11px]", deltaColor)}>{delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "•"} {delta.text}</div>}
        {progress && <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, progress.pct))}%`, background: a.hex }} /></div>}
        {(sub || progress?.label) && <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub ?? progress?.label}>{progress?.label ?? sub}</div>}
      </div>
    </Link>
  );
}
