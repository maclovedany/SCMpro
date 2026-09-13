import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/getProfile";
import { menuGroupsForRole } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AiPanelProvider } from "@/components/ai/AiPanelProvider";
import { AiShell } from "@/components/ai/AiShell";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const sb = await createServerSupabase();
  const { data: b } = await withRetry(() => sb.schema("app").rpc("fn_sidebar_badges"));   // 배지 2종을 한 번의 왕복으로
  const badges = (b ?? { unread: 0, approvals: 0 }) as { unread: number; approvals: number };
  return (
    <AiPanelProvider>
      <AiShell>
        <div className="flex min-h-screen">
          <Sidebar groups={menuGroupsForRole(profile.role)} badges={badges} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar profile={profile} unread={badges.unread} />
            <main className="flex-1 px-6 py-5">{children}</main>
          </div>
        </div>
      </AiShell>
    </AiPanelProvider>
  );
}
