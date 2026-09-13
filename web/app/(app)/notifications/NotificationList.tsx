"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markRead } from "@/app/(app)/approvals/actions";
import { notificationHref, type NotificationRow } from "@/lib/queries/notifications";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
export function NotificationList({ rows, showingAll }: { rows: NotificationRow[]; showingAll: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = (n: NotificationRow) => start(async () => { if (!n.read_at) await markRead([n.id]); router.push(notificationHref(n)); });
  const unread = rows.filter(r => !r.read_at).map(r => r.id);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-sm">
        <Link href={showingAll ? "/notifications" : "/notifications?all=1"} className="underline">{showingAll ? "미읽음만 보기" : "전체 보기"}</Link>
        {unread.length > 0 && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await markRead(unread); router.refresh(); })}>모두 읽음 ({unread.length})</Button>}
      </div>
      {rows.length === 0 && <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">알림이 없습니다</p>}
      {rows.map(n => (
        <button key={n.id} type="button" onClick={() => open(n)} className={cn("block w-full rounded-md border p-3 text-left hover:bg-muted/40", !n.read_at && "border-l-4 border-l-primary")}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium">{n.title}</span><span className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</span></div>
          {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
        </button>
      ))}
    </div>
  );
}
