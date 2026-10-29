import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Aurora } from "@/components/brand/aurora";
import { Toaster } from "@/components/ui/sonner";
import { LiveDashboardProvider } from "@/components/layout/live-dashboard-provider";
import { RouteEnter } from "@/components/layout/route-enter";
import { ShemeshMobileDock } from "@/components/shemesh/mobile-dock";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshBreadcrumbs } from "@/components/shemesh/breadcrumbs";
import { ShemeshPulseProvider } from "@/components/shemesh/pulse-context";
import { ShemeshSourceProvider } from "@/components/shemesh/source-context";
import { ShemeshTheme } from "@/components/shemesh/theme";
import { ShemeshTopbar } from "@/components/shemesh/topbar";
import { ShemeshSkeleton } from "@/components/shemesh/widgets";
import { shemeshProfile } from "@/lib/shemesh/actor";
import { canViewShemesh } from "@/lib/permissions/access";
import { assessShemeshSources } from "@/lib/shemesh/connectors";
import { loadShemeshPulse } from "@/lib/shemesh/load-pulse";

export const metadata: Metadata = {
  title: "שמש",
};

function stamp(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function markSource(
  sources: { id: string; connection: "awaiting_access" | "credentials_present"; lastSyncedAt: string | null; message: string }[],
  id: string,
  syncedAt: string | null,
  hasRows: boolean,
) {
  const source = sources.find((item) => item.id === id);
  if (!source || (!syncedAt && !hasRows)) return;
  source.connection = "credentials_present";
  source.lastSyncedAt = stamp(syncedAt);
  source.message = "מחובר ומסונכרן.";
}

export default async function ShemeshLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await shemeshProfile();
  if (!profile) redirect("/login");
  const sources = assessShemeshSources(process.env);
  const pulse = await loadShemeshPulse().catch(() => null);
  const live = pulse ?? {
    googleSyncedAt: null,
    facebookSyncedAt: null,
    excelSyncedAt: null,
    campaigns: [],
    collection: [],
    invoices: [],
    finance: { commission: 0, settled: 0, rows: 0 },
  };
  markSource(sources, "shared_folder", live.excelSyncedAt, live.collection.length > 0);
  markSource(
    sources,
    "facebook_ads",
    live.facebookSyncedAt,
    live.campaigns.some((campaign) => campaign.channel === "facebook"),
  );
  markSource(
    sources,
    "google_ads",
    live.googleSyncedAt,
    live.campaigns.some((campaign) => campaign.channel === "google"),
  );

  if (!canViewShemesh(profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold">שמש</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            המערכת זמינה למי שיש לו הרשאת שמש.
          </p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-medium underline">
            חזרה לליבה
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LiveDashboardProvider>
      <ShemeshTheme />
      <div className="shemesh-os os-mesh flex h-dvh min-h-0 overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
        <Aurora tone="shemesh" />
        <ShemeshSidebar className="hidden lg:flex print:hidden" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col print:block print:h-auto print:overflow-visible">
          <div className="print:hidden">
            <ShemeshTopbar profile={profile} />
          </div>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto px-4 py-6 sm:px-6 lg:py-8 print:block print:h-auto print:overflow-visible print:p-0">
            <ShemeshBreadcrumbs />
            <RouteEnter>
              <Suspense fallback={<ShemeshSkeleton />}>
                <ShemeshPulseProvider pulse={live}>
                  <ShemeshSourceProvider sources={sources}>{children}</ShemeshSourceProvider>
                </ShemeshPulseProvider>
              </Suspense>
            </RouteEnter>
          </main>
          <ShemeshMobileDock />
        </div>
      </div>
      <Toaster dir="rtl" position="top-center" />
    </LiveDashboardProvider>
  );
}
