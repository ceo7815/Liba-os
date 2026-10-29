import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadCampaignBoard } from "@/app/actions/campaigns-board";
import { CampaignsScreen } from "@/components/campaigns/campaigns-screen";
import { ShemeshMarketingReport } from "@/components/shemesh/marketing-report";
import { loadShemeshMetaReport } from "@/lib/shemesh/meta-report";
import { shemeshProfile } from "@/lib/shemesh/actor";
import type { CampaignBoard } from "@/lib/campaigns/board";
import { canAccessSourcePnl } from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "קמפיינים",
};

export default async function ShemeshMarketingPage() {
  const profile = await shemeshProfile();
  if (!profile) redirect("/login");
  if (!canAccessSalesDashboard(profile) && !canAccessSourcePnl(profile)) {
    redirect("/shemesh");
  }
  const emptyBoard: CampaignBoard = {
    today: new Date().toISOString().slice(0, 10),
    historyFrom: "2026-01-01",
    canSync: false,
    google: { connected: false, lastSyncedAt: null, lastError: null, campaigns: [] },
    facebook: { connected: false, lastSyncedAt: null, lastError: null, campaigns: [] },
    calls: { days: [], phones: [], truncated: false },
    googleCalls: [],
    googleCallsError: null,
  };
  const [initial, meta] = await Promise.all([
    loadCampaignBoard().catch(() => emptyBoard),
    loadShemeshMetaReport().catch(() => ({ accountId: "2542541459538449", connected: false, missing: false, error: "חשבון שמש לא נקרא", rows: [], fetchedAt: null })),
  ]);
  return (
    <>
      <ShemeshMarketingReport accountId={meta.accountId} error={meta.error} rows={meta.rows} />
      <CampaignsScreen initial={initial} brand="shemesh" />
    </>
  );
}
