import { LiveDashboardProvider } from "@/components/layout/live-dashboard-provider";
import { MainRegion } from "@/components/layout/main-region";
import { ShellFrame } from "@/components/layout/shell-frame";
import { MobileDock } from "@/components/layout/mobile-dock";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <LiveDashboardProvider>
      <ShellFrame>
        <Sidebar profile={profile} className="hidden lg:flex" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar profile={profile} />
          <MainRegion>{children}</MainRegion>
          <MobileDock profile={profile} />
        </div>
      </ShellFrame>
    </LiveDashboardProvider>
  );
}
