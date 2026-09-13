import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/getProfile";
import { menuForRole } from "@/lib/auth/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AiPanelProvider } from "@/components/ai/AiPanelProvider";
import { AiShell } from "@/components/ai/AiShell";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <AiPanelProvider>
      <AiShell>
        <div className="flex min-h-screen">
          <Sidebar menu={menuForRole(profile.role)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar profile={profile} />
            <main className="flex-1 px-6 py-5">{children}</main>
          </div>
        </div>
      </AiShell>
    </AiPanelProvider>
  );
}
