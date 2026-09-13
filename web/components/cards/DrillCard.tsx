import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
export type DrillCardProps = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger"; icon?: React.ReactNode };
/** 모든 요약 카드는 이 컴포넌트로만 — href 필수 (R-UI-01) */
export function DrillCard({ label, value, hint, href, tone = "default", icon }: DrillCardProps) {
  return (
    <Link href={href} prefetch className="group block h-full" aria-label={`${label} 상세 보기`}>
      <Card className={cn("flex h-full min-h-[7.5rem] flex-col gap-1 p-4 transition hover:border-primary hover:shadow-md", tone === "danger" && "border-red-300 bg-red-50/40", tone === "warn" && "border-amber-300 bg-amber-50/40")}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">{icon}{label}</span>
          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
        </div>
        <div className="truncate text-2xl font-semibold tabular-nums" title={value}>{value}</div>
        {hint && <div className="line-clamp-2 min-h-[2rem] text-xs text-muted-foreground" title={hint}>{hint}</div>}
      </Card>
    </Link>
  );
}
