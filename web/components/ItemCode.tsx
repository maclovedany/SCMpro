import { cn } from "@/lib/utils";
/** 품목코드 + 품명 병기 (R-UI-15, D-058): 코드는 고정폭, 품명은 보조색·truncate+툴팁. 코드를 외우지 않는 부서가 바로 알아보게 한다 */
export function ItemCode({ code, name, className, maxName = "14rem" }: { code: string | null | undefined; name?: string | null; className?: string; maxName?: string }) {
  if (!code) return <span className="text-muted-foreground">-</span>;
  return (
    <span className={cn("inline-flex max-w-full items-baseline gap-1.5 whitespace-nowrap align-baseline", className)} data-testid="item-code">
      <span className="font-mono">{code}</span>
      {name && <span className="truncate text-xs text-muted-foreground" style={{ maxWidth: maxName }} title={name}>{name}</span>}
    </span>
  );
}
