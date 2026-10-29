import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadCampaignBoard } from "@/app/actions/campaigns-board";
import { CampaignsScreen } from "@/components/campaigns/campaigns-screen";
import { BudgetForm } from "@/components/shemesh/archive-forms";
import { budgetRemainder, loadAdBudget, spendForecast } from "@/lib/shemesh/closing";
import { loadShemeshPulse } from "@/lib/shemesh/load-pulse";
import { sliceAds } from "@/lib/shemesh/pulse";
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
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()).slice(0, 7);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const [budget, pulse] = await Promise.all([
    loadAdBudget(month).catch(() => ({ missing: true, amount: null })),
    loadShemeshPulse().catch(() => null),
  ]);
  const ads = pulse ? sliceAds(pulse, { from: `${month}-01`, to: today, channel: "all" }) : null;
  const spent = ads && ads.spend > 0 ? ads.spend : null;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const forecast = spent == null ? null : spendForecast(spent, Number(today.slice(8, 10)), daysInMonth);
  return (
    <>
      <ShemeshMarketingReport accountId={meta.accountId} error={meta.error} rows={meta.rows} />
      <div className="mx-auto mb-4 max-w-[76rem]">
        <BudgetForm month={month} amount={budget.amount} spent={spent} forecast={forecast} remainder={budgetRemainder(budget.amount, spent, forecast)} />
      </div>
      <CampaignsScreen initial={initial} brand="shemesh" />
    </>
  );
}
