"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import * as Icons from "lucide-react";
import type { MenuGroup } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
type Badges = { approvals?: number; unread?: number };
const KEY = "scm.sidebar.collapsed";
/** R-UI-11: 업무 그룹 라벨 + 항목, 관리 그룹은 하단 분리, 처리 건수 배지, 그룹 접기 상태 기억 */
export function Sidebar({ groups, badges = {} }: { groups: MenuGroup[]; badges?: Badges }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => { if (ready) return; let v: Record<string, boolean> = {}; try { v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch {} startTransition(() => { setCollapsed(v); setReady(true); }); }, [ready]);
  const toggle = (k: string) => setCollapsed(c => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} return n; });
  const top = groups.filter(g => !g.bottom), bottom = groups.filter(g => g.bottom);
  const render = (g: MenuGroup) => (
    <div key={g.key} className="px-2">
      <button type="button" onClick={() => toggle(g.key)} className="flex w-full items-center justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" aria-expanded={!collapsed[g.key]}>
        <span>{g.label}</span><Icons.ChevronDown className={cn("h-3 w-3 transition-transform", collapsed[g.key] && "-rotate-90")} />
      </button>
      {!collapsed[g.key] && g.items.map(m => {
        const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[m.icon] ?? Icons.Circle;
        const active = pathname === m.href || (m.href !== "/allocation" && pathname.startsWith(m.href + "/")) || (m.href === "/allocation" && pathname === "/allocation");
        const n = m.badge ? badges[m.badge] : undefined;
        return (
          <Link key={m.href} href={m.href} prefetch className={cn("flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors hover:border-[#7CFF3B] hover:bg-[#f3ffe6]", active && "border-transparent bg-[#fff1cc] font-medium text-[#8a5a00] hover:border-[#7CFF3B]")}>
            <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{m.label}</span>
            {!!n && n > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{n > 99 ? "99+" : n}</span>}
          </Link>
        );
      })}
    </div>
  );
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r bg-muted/20">
      <div className="px-5 py-4 text-lg font-bold tracking-tight">SCMpro</div>
      <nav className="flex flex-1 flex-col" aria-label="주 메뉴">
        <div className="flex-1">{top.map(render)}</div>
        {bottom.length > 0 && <div className="mt-2 border-t pb-3">{bottom.map(render)}</div>}
      </nav>
    </aside>
  );
}
