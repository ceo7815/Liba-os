import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
import { DashHero } from "@/components/dashboard/dash-hero";
import { LeadControlScreen } from "@/components/lead-control/screen";
import { AppShell } from "@/components/layout/app-shell";
import { ShemeshMobileDock } from "@/components/shemesh/mobile-dock";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshDashboard } from "@/components/shemesh/dashboard-screen";
import { ShemeshPulseProvider } from "@/components/shemesh/pulse-context";
import { PERMISSION_KEYS } from "@/lib/permissions/catalog";
import type { ShemeshPulse } from "@/lib/shemesh/pulse";
import type { Profile } from "@/lib/types";

const previewProfile: Profile = {
  id: "design-lab",
  email: "preview@liba.invalid",
  full_name: "מנהל הדגמה",
  role: "admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  permissionKeys: [...PERMISSION_KEYS],
};

const shemeshPreview: ShemeshPulse = {
  googleSyncedAt: "2026-10-29T09:00:00.000Z",
  facebookSyncedAt: "2026-10-29T09:00:00.000Z",
  excelSyncedAt: "2026-10-29T09:00:00.000Z",
  campaigns: [
    {
      id: "demo-g",
      name: "קמפיין הדגמה",
      channel: "google",
      active: true,
      days: [
        { day: "2026-10-12", cost: 400, leads: 6 },
        { day: "2026-10-20", cost: 520, leads: 8 },
      ],
    },
    {
      id: "demo-f",
      name: "קמפיין הדגמה ב",
      channel: "facebook",
      active: true,
      days: [{ day: "2026-10-18", cost: 300, leads: 4 }],
    },
  ],
  collection: [],
  invoices: [],
  finance: { commission: 2400, settled: 1800, rows: 3 },
};

const emptyLeads = {
  fetchedAt: "2026-10-29T09:00:00.000Z",
  configured: true,
  error: null,
  truncated: false,
  items: [],
};

/** Local visual preview of the shell. Production builds return 404. */
export default function DesignLabPage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const today = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  if (searchParams?.view === "shemesh") {
    return (
      <div className="shemesh-os os-mesh min-h-dvh bg-background">
        <ShemeshPulseProvider pulse={shemeshPreview}>
          <Suspense fallback={null}>
            <div className="flex min-h-dvh">
              <ShemeshSidebar className="hidden lg:flex" />
              <div className="min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-28 lg:px-6">
                <ShemeshDashboard />
              </div>
            </div>
            <ShemeshMobileDock />
          </Suspense>
        </ShemeshPulseProvider>
      </div>
    );
  }

  return (
    <AppShell profile={previewProfile}>
      {searchParams?.view === "leads" ? (
        <LeadControlScreen snapshot={emptyLeads} />
      ) : (
      <section className="w-full space-y-4">
        <DashHero name="מנהל הדגמה" date={today} />
        <ControlCenterScreen />
      </section>
      )}
    </AppShell>
  );
}
