import { MainRegion } from "@/components/layout/main-region";
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
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} className="hidden lg:flex" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />
        <MainRegion>{children}</MainRegion>
      </div>
    </div>
  );
}
