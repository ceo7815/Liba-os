"use server";

import { readFacebookAdsBundle } from "@/app/actions/facebook-ads";
import { readGoogleAdsBundle } from "@/app/actions/google-ads";
import { requireProfile } from "@/lib/auth";
import { campaignMatchesBrand, sumPoints, type CampaignPoint } from "@/lib/campaigns/board";
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

function bucketPoints(
  rows: { id: string; day: string; cost: number; leads: number; clicks: number; impressions: number }[],
): Map<string, CampaignPoint[]> {
  const byId = new Map<string, CampaignPoint[]>();
  for (const row of rows) {
    const list = byId.get(row.id) ?? [];
    list.push({
      day: row.day.slice(0, 10),
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    });
    byId.set(row.id, list);
  }
  return byId;
}

function sumBrand(
  included: boolean[],
  ids: string[],
  points: Map<string, CampaignPoint[]>,
  from: string,
  today: string,
) {
  let cost = 0;
  let leads = 0;
  let todayCost = 0;
  let todayLeads = 0;
  included.forEach((keep, index) => {
    if (!keep) return;
    const series = points.get(ids[index] ?? "") ?? [];
    const month = sumPoints(series, from, today);
    const day = sumPoints(series, today, today);
    cost += month.cost;
    leads += month.leads;
    todayCost += day.cost;
    todayLeads += day.leads;
  });
  return { cost, leads, todayCost, todayLeads };
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

  const googlePoints = bucketPoints(
    google.stats.map((row) => ({
      id: row.googleCampaignId,
      day: row.day,
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    })),
  );
  const facebookPoints = bucketPoints(
    facebook.stats.map((row) => ({
      id: row.facebookCampaignId,
      day: row.day,
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    })),
  );
  const googleSide = sumBrand(
    google.campaigns.map((row) =>
      campaignMatchesBrand(
        { name: row.googleCampaignName, sourceName: row.sourceName, channel: "google" },
        "liba",
      ),
    ),
    google.campaigns.map((row) => row.googleCampaignId),
    googlePoints,
    from,
    today,
  );
  const facebookSide = sumBrand(
    facebook.campaigns.map((row) =>
      campaignMatchesBrand(
        {
          name: row.facebookCampaignName,
          sourceName: row.sourceName,
          channel: "facebook",
          adAccountName: row.adAccountName,
        },
        "liba",
      ),
    ),
    facebook.campaigns.map((row) => row.facebookCampaignId),
    facebookPoints,
    from,
    today,
  );
  const googleSpend = googleSide.cost;
  const googleCalls = googleSide.leads;
  const todayGoogleSpend = googleSide.todayCost;
  const todayGoogleCalls = googleSide.todayLeads;
  const facebookSpend = facebookSide.cost;
  const facebookForms = facebookSide.leads;
  const todayFacebookSpend = facebookSide.todayCost;
  const todayFacebookForms = facebookSide.todayLeads;

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
