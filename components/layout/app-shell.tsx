import type { DashboardCampaignPulse } from "@/app/actions/dashboard-pulse";
import { LiveDashboardProvider } from "@/components/layout/live-dashboard-provider";
import { MainRegion } from "@/components/layout/main-region";
import { ShellFrame, type OsModule } from "@/components/layout/shell-frame";
import { MobileDock } from "@/components/layout/mobile-dock";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { DashboardData } from "@/lib/sales-dashboard/types";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  children,
  previewDashboard,
  campaignPulse,
  module,
}: {
  profile: Profile;
  children: React.ReactNode;
  /** Dev preview only. Leaves the live sync path untouched when omitted. */
  previewDashboard?: DashboardData | null;
  campaignPulse?: DashboardCampaignPulse | null;
  module?: OsModule;
}) {
  return (
    <LiveDashboardProvider preview={previewDashboard} campaignPulse={campaignPulse}>
      <ShellFrame module={module}>
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
