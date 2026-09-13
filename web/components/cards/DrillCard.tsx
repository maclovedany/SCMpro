import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
export type DrillCardProps = { label: string; value: string; hint?: string; href: string; tone?: "default" | "warn" | "danger"; icon?: React.ReactNode };
/** 모든 요약 카드는 이 컴포넌트로만 — href 필수 (R-UI-01) */
export function DrillCard({ label, value, hint, href, tone = "default", icon }: DrillCardProps) {
  return (
    <Link href={href} prefetch className="group block" aria-label={`${label} 상세 보기`}>
      <Card className={cn("gap-1 p-4 transition hover:border-primary hover:shadow-md", tone === "danger" && "border-red-300 bg-red-50/40", tone === "warn" && "border-amber-300 bg-amber-50/40")}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">{icon}{label}</span>
          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </Card>
    </Link>
  );
}
