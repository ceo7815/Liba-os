import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadCampaignBoard } from "@/app/actions/campaigns-board";
import { CampaignsScreen } from "@/components/campaigns/campaigns-screen";
import { ShemeshMarketingReport } from "@/components/shemesh/marketing-report";
import { loadShemeshMetaReport } from "@/lib/shemesh/meta-report";
import { requireProfile } from "@/lib/auth";
import { canAccessSourcePnl } from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "קמפיינים",
};

export default async function ShemeshMarketingPage() {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile) && !canAccessSourcePnl(profile)) {
    redirect("/shemesh");
  }
  const [initial, meta] = await Promise.all([loadCampaignBoard(), loadShemeshMetaReport()]);
  return (
    <>
      <ShemeshMarketingReport accountId={meta.accountId} error={meta.error} rows={meta.rows} />
      <CampaignsScreen initial={initial} brand="shemesh" />
    </>
  );
}
