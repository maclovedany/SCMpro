import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACCENT, type AccentKey } from "@/lib/design/palette";
export type DrillCardProps = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger"; icon?: React.ReactNode; accent?: AccentKey; compact?: boolean };
/** 모든 요약 카드는 이 컴포넌트로만 — href 필수 (R-UI-01) */
export function DrillCard({ label, value, hint, href, tone = "default", icon, accent, compact }: DrillCardProps) {
  const a = accent ? ACCENT[accent] : null;
  return (
    <Link href={href} prefetch className="group block h-full" aria-label={`${label} 상세 보기`}>
      <Card className={cn("scm-card flex h-full flex-col gap-1 rounded-xl", compact ? "min-h-[5.5rem] p-3" : "min-h-[7.5rem] p-4")} data-tone={tone} style={a && tone === "default" ? ({ "--acc": a.hex, "--acc-soft": a.soft } as React.CSSProperties) : undefined}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">{icon}{label}</span>
          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
        </div>
        <div className={cn("truncate font-semibold tabular-nums", compact ? "text-xl" : "text-2xl")} title={value}>{value}</div>
        {hint && <div className={cn("text-xs text-muted-foreground", compact ? "line-clamp-1" : "line-clamp-2 min-h-[2rem]")} title={hint}>{hint}</div>}
      </Card>
    </Link>
  );
}
