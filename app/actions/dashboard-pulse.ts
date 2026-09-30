"use server";

import { readFacebookAdsBundle } from "@/app/actions/facebook-ads";
import { readGoogleAdsBundle } from "@/app/actions/google-ads";
import { requireProfile } from "@/lib/auth";
import { canAccessSourcePnl } from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import { jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";

export type DashboardCampaignPulse = {
  from: string;
  to: string;
  today: string;
  spend: number;
  googleSpend: number;
  facebookSpend: number;
  googleCalls: number;
  facebookForms: number;
  todaySpend: number;
  todayGoogleCalls: number;
  todayFacebookForms: number;
  googleSyncedAt: string | null;
  facebookSyncedAt: string | null;
};

function inSpan(day: string, from: string, to: string): boolean {
  const key = day.slice(0, 10);
  return key >= from && key <= to;
}

export async function loadDashboardCampaignPulse(): Promise<DashboardCampaignPulse | null> {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile) && !canAccessSourcePnl(profile)) return null;
  const today = jerusalemYmd();
  const from = `${today.slice(0, 8)}01`;
  const [google, facebook] = await Promise.all([
    readGoogleAdsBundle({ from, to: today }),
    readFacebookAdsBundle({ from, to: today }),
  ]);
  const hasStats = google.stats.length > 0 || facebook.stats.length > 0;
  if (!google.connection.connected && !facebook.connection.connected && !hasStats) return null;

  let googleSpend = 0;
  let googleCalls = 0;
  let todayGoogleSpend = 0;
  let todayGoogleCalls = 0;
  for (const row of google.stats) {
    if (!inSpan(row.day, from, today)) continue;
    googleSpend += row.cost;
    googleCalls += row.leads;
    if (row.day.slice(0, 10) === today) {
      todayGoogleSpend += row.cost;
      todayGoogleCalls += row.leads;
    }
  }
  let facebookSpend = 0;
  let facebookForms = 0;
  let todayFacebookSpend = 0;
  let todayFacebookForms = 0;
  for (const row of facebook.stats) {
    if (!inSpan(row.day, from, today)) continue;
    facebookSpend += row.cost;
    facebookForms += row.leads;
    if (row.day.slice(0, 10) === today) {
      todayFacebookSpend += row.cost;
      todayFacebookForms += row.leads;
    }
  }

  return {
    from,
    to: today,
    today,
    spend: googleSpend + facebookSpend,
    googleSpend,
    facebookSpend,
    googleCalls,
    facebookForms,
    todaySpend: todayGoogleSpend + todayFacebookSpend,
    todayGoogleCalls,
    todayFacebookForms,
    googleSyncedAt: google.connection.lastSyncedAt,
    facebookSyncedAt: facebook.connection.lastSyncedAt,
  };
}
