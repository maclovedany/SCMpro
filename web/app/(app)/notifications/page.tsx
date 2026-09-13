import { createServerSupabase } from "@/lib/supabase/server";
import { fetchNotifications } from "@/lib/queries/notifications";
import { NotificationList } from "./NotificationList";
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const rows = await fetchNotifications(await createServerSupabase(), all !== "1");
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">알림</h1><p className="text-sm text-muted-foreground">승인 요청·결과, 배정·만료 알림 (R-SCH-30). 이메일 채널은 SP4/5.</p></div>
      <NotificationList rows={rows} showingAll={all === "1"} />
    </div>
  );
}
