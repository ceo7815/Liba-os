import {
  accountDigits,
  DEFAULT_SHEMESH_AD_ACCOUNTS,
  shemeshAdAccountIds,
} from "@/lib/finance/brand-accounts";
import { isMissingRelation } from "@/lib/shemesh/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicErrorText } from "@/lib/sync-log";

export type ShemeshStatRow = {
  campaignId: string;
  campaignName: string;
  adId: string;
  adName: string;
  day: string;
  cost: number;
  leads: number;
  grain: "campaign" | "ad";
};

export type ShemeshMetaReport = {
  accountId: string;
  connected: boolean;
  missing: boolean;
  error: string | null;
  rows: ShemeshStatRow[];
  fetchedAt: string | null;
};

export async function loadShemeshMetaReport(): Promise<ShemeshMetaReport> {
  const accountId = DEFAULT_SHEMESH_AD_ACCOUNTS[0];
  const empty: ShemeshMetaReport = {
    accountId,
    connected: false,
    missing: false,
    error: null,
    rows: [],
    fetchedAt: null,
  };
  try {
    const admin = createAdminClient();
    const maps = await admin
      .from("facebook_ads_campaign_map")
      .select("facebook_campaign_id, facebook_campaign_name, ad_account_id");
    if (maps.error) {
      if (isMissingRelation(maps.error.message)) {
        return { ...empty, missing: true, error: "טבלת הקמפיינים עדיין לא במסד. אחרי סנכרון פייסבוק יופיעו כאן מספרים." };
      }
      return { ...empty, error: maps.error.message };
    }
    const allowed = shemeshAdAccountIds();
    const campaigns = (maps.data ?? []).filter((row) =>
      allowed.has(accountDigits(String(row.ad_account_id ?? ""))),
    );
    const ids = campaigns.map((row) => String(row.facebook_campaign_id));
    if (!ids.length) {
      return {
        ...empty,
        connected: true,
        error: "אין עדיין קמפיינים שמורים לחשבון שמש. סנכרון המערכת ממלא את facebook_ads_daily_stats.",
      };
    }
    const names = new Map(campaigns.map((row) => [String(row.facebook_campaign_id), String(row.facebook_campaign_name ?? "")]));
    const stats = await admin
      .from("facebook_ads_daily_stats")
      .select("facebook_campaign_id, day, cost, leads")
      .in("facebook_campaign_id", ids);
    if (stats.error) {
      if (isMissingRelation(stats.error.message)) {
        return { ...empty, missing: true, error: "טבלת ההוצאה היומית עדיין לא במסד." };
      }
      return { ...empty, connected: true, error: stats.error.message };
    }
    const rows: ShemeshStatRow[] = (stats.data ?? []).map((row) => {
      const campaignId = String(row.facebook_campaign_id);
      const campaignName = names.get(campaignId) || campaignId;
      return {
        campaignId,
        campaignName,
        adId: campaignId,
        adName: campaignName,
        day: String(row.day).slice(0, 10),
        cost: Number(row.cost) || 0,
        leads: Number(row.leads) || 0,
        grain: "campaign",
      };
    });
    return { accountId, connected: true, missing: false, error: null, rows, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = publicErrorText(error instanceof Error ? error.message : "פייסבוק לא נקרא");
    if (isMissingRelation(message)) {
      return { ...empty, missing: true, error: "נתוני המודעות עדיין לא במסד." };
    }
    console.error("[facebook-sync] shemesh ads read failed", { accountId, message });
    return { ...empty, error: message };
  }
}
