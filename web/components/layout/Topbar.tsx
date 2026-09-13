import Link from "next/link";
import { Bell } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { Profile } from "@/lib/auth/getProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { AiPanelButton } from "@/components/ai/AiPanelButton";
export async function Topbar({ profile }: { profile: Profile }) {
  const sb = await createServerSupabase();
  const { data: unread } = await withRetry(() => sb.schema("app").rpc("fn_unread_count"));
  return (
    <header className="flex h-12 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">복합기 수요예측 · 월간 발주 시스템</div>
      <div className="flex items-center gap-3">
        <AiPanelButton />
        <Link href="/notifications" className="relative" aria-label="알림">
          <Bell className="h-4 w-4" />
          {!!unread && unread > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1 text-[10px] text-white">{unread}</span>}
        </Link>
        <span className="text-sm">{profile.name}</span>
        <Badge variant="secondary">{ROLE_LABEL[profile.role]}</Badge>
        <form action={logout}><Button variant="ghost" size="sm" type="submit">로그아웃</Button></form>
      </div>
    </header>
  );
}
