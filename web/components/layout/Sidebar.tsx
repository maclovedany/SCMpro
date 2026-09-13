"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import type { MenuItem } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
export function Sidebar({ menu }: { menu: MenuItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/20">
      <div className="px-5 py-4 text-lg font-bold tracking-tight">SCMpro</div>
      <nav className="flex flex-col gap-0.5 px-2" aria-label="주 메뉴">
        {menu.map(m => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[m.icon] ?? Icons.Circle;
          const active = pathname === m.href || pathname.startsWith(m.href + "/");
          return (
            <Link key={m.href} href={m.href} prefetch
              className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted", active && "bg-primary/10 font-medium text-primary")}>
              <Icon className="h-4 w-4" />{m.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
