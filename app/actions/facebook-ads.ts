"use server";

import { revalidatePath } from "next/cache";
import { requireSourcePnlAccess } from "@/lib/auth";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { jerusalemYmd, type DateRange, type FacebookAdsCampaignRow, type FacebookAdsDailyStat } from "@/lib/sales-dashboard/campaign-math";
import { encryptVaultSecret, decryptVaultSecret, hasVaultEncryptionKey } from "@/lib/vault/crypto";
import {
  envFacebookAccessToken,
  envFacebookAdAccountId,
  facebookAdsOAuthConfigured,
} from "@/lib/facebook-ads/config";
import {
  extendFacebookToken,
  facebookMeName,
  listFacebookAdAccounts,
  listFacebookCampaigns,
  listFacebookDailyMetrics,
} from "@/lib/facebook-ads/client";

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(
    message &&
      (/does not exist/i.test(message) || /schema cache/i.test(message) || /could not find/i.test(message)),
  );
}

export type FacebookAdsConnection = {
  oauthReady: boolean;
  connected: boolean;
  adAccountId: string | null;
  adAccountName: string | null;
  connectedName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  needsAccountPick: boolean;
};

export type FacebookAdsBundle = {
  connection: FacebookAdsConnection;
  campaigns: FacebookAdsCampaignRow[];
  stats: FacebookAdsDailyStat[];
};

const emptyConnection = (): FacebookAdsConnection => ({
  oauthReady: facebookAdsOAuthConfigured(),
  connected: false,
  adAccountId: null,
  adAccountName: null,
  connectedName: null,
  lastSyncedAt: null,
  lastError: null,
  needsAccountPick: false,
});

function applyStatsRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  range?: DateRange,
): T {
  if (range?.from) query = query.gte("day", range.from);
  if (range?.to) query = query.lte("day", range.to);
  return query;
}

const STATS_PAGE_SIZE = 1000;

async function fetchFacebookDailyStats(
  admin: ReturnType<typeof createAdminClient>,
  statsRange?: DateRange,
): Promise<
  {
    facebook_campaign_id: string;
    day: string;
    cost: number;
    clicks: number;
    impressions: number;
  }[]
> {
  const out: {
    facebook_campaign_id: string;
    day: string;
    cost: number;
    clicks: number;
    impressions: number;
  }[] = [];
  for (let from = 0; ; from += STATS_PAGE_SIZE) {
    let query = admin
      .from("facebook_ads_daily_stats")
      .select("facebook_campaign_id, day, cost, clicks, impressions")
      .order("day", { ascending: true })
      .order("facebook_campaign_id", { ascending: true })
      .range(from, from + STATS_PAGE_SIZE - 1);
    query = applyStatsRange(query, statsRange);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelation(error.message)) return [];
      throw new Error(error.message);
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < STATS_PAGE_SIZE) break;
  }
  return out;
}

export async function readFacebookAdsBundle(statsRange?: DateRange): Promise<FacebookAdsBundle> {
  const admin = createAdminClient();
  const [settings, maps, statsRows] = await Promise.all([
    admin
      .from("facebook_ads_settings")
      .select(
        "ad_account_id, ad_account_name, access_token_encrypted, connected_name, last_synced_at, last_error",
      )
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("facebook_ads_campaign_map")
      .select("facebook_campaign_id, facebook_campaign_name, status, source_name, enabled")
      .order("facebook_campaign_name"),
    fetchFacebookDailyStats(admin, statsRange),
  ]);

  if (isMissingRelation(settings.error?.message) || isMissingRelation(maps.error?.message)) {
    return { connection: emptyConnection(), campaigns: [], stats: [] };
  }
  if (maps.error) throw new Error(maps.error.message);
  if (settings.error && !isMissingRelation(settings.error.message)) {
    throw new Error(settings.error.message);
  }

  const row = settings.data;
  const envToken = envFacebookAccessToken();
  const dbToken = Boolean(row?.access_token_encrypted);
  const adAccountId = envFacebookAdAccountId() || row?.ad_account_id || null;
  const connected = Boolean(envToken || dbToken);

  return {
    connection: {
      oauthReady: facebookAdsOAuthConfigured() || Boolean(envToken),
      connected,
      adAccountId,
      adAccountName: row?.ad_account_name ?? null,
      connectedName: row?.connected_name ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
      lastError: row?.last_error ?? null,
      needsAccountPick: false,
    },
    campaigns: (maps.data ?? []).map((item) => ({
      facebookCampaignId: String(item.facebook_campaign_id),
      facebookCampaignName: item.facebook_campaign_name,
      status: item.status,
      sourceName: item.source_name,
      enabled: item.enabled !== false,
    })),
    stats: statsRows.map((item) => ({
      facebookCampaignId: String(item.facebook_campaign_id),
      day: String(item.day).slice(0, 10),
      cost: Number(item.cost) || 0,
      clicks: Number(item.clicks) || 0,
      impressions: Number(item.impressions) || 0,
    })),
  };
}

async function resolveAccessToken(): Promise<string> {
  const fromEnv = envFacebookAccessToken();
  if (fromEnv) return fromEnv;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("facebook_ads_settings")
    .select("access_token_encrypted")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const encrypted = data?.access_token_encrypted;
  if (!encrypted) throw new Error("פייסבוק לא מחובר");
  if (!hasVaultEncryptionKey()) {
    throw new Error("חסר מפתח הצפנה בשרת לפיענוח החיבור לפייסבוק");
  }
  return decryptVaultSecret(encrypted);
}

async function writeSettingsError(message: string) {
  const admin = createAdminClient();
  await admin.from("facebook_ads_settings").upsert({
    id: 1,
    last_error: message,
    updated_at: new Date().toISOString(),
  });
}

export async function saveFacebookAdsToken(
  accessToken: string,
  expiresAt?: string | null,
  name?: string | null,
) {
  if (!hasVaultEncryptionKey()) {
    throw new Error("חסר VAULT_ENCRYPTION_KEY להצפנת החיבור לפייסבוק");
  }
  const extended = await extendFacebookToken(accessToken);
  const connectedName = name ?? (await facebookMeName(extended.accessToken));
  const admin = createAdminClient();
  const { error } = await admin.from("facebook_ads_settings").upsert({
    id: 1,
    access_token_encrypted: encryptVaultSecret(extended.accessToken),
    token_expires_at: expiresAt || extended.expiresAt,
    connected_name: connectedName,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listFacebookAccounts(): Promise<{
  ok: boolean;
  accounts?: { id: string; name: string }[];
  error?: string;
}> {
  await requireSourcePnlAccess();
  try {
    const token = await resolveAccessToken();
    const accounts = await listFacebookAdAccounts(token);
    return { ok: true, accounts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה";
    return { ok: false, error: message };
  }
}

export async function saveFacebookAdAccount(
  adAccountId: string,
  adAccountName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const id = adAccountId.replace(/^act_/i, "").replace(/\D/g, "");
  if (id.length < 6) return { ok: false, error: "מזהה חשבון מודעות לא תקין" };
  const admin = createAdminClient();
  const { error } = await admin.from("facebook_ads_settings").upsert({
    id: 1,
    ad_account_id: id,
    ad_account_name: adAccountName?.trim() || null,
    last_error: null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function mapFacebookAdsCampaign(input: {
  facebookCampaignId: string;
  sourceName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const facebookCampaignId = input.facebookCampaignId.trim();
  const sourceName = input.sourceName.trim();
  if (!facebookCampaignId) return { ok: false, error: "חסר מזהה קמפיין" };
  if (!sourceName) return { ok: false, error: "חסר שם קוביה" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("facebook_ads_campaign_map")
    .update({
      source_name: sourceName,
      mapped_by: profile.id,
      mapped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("facebook_campaign_id", facebookCampaignId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function unmapFacebookAdsCampaign(
  facebookCampaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSourcePnlAccess();
  const id = facebookCampaignId.trim();
  if (!id) return { ok: false, error: "חסר מזהה קמפיין" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("facebook_ads_campaign_map")
    .update({
      source_name: null,
      mapped_at: null,
      mapped_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("facebook_campaign_id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function syncFacebookAds(): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  campaigns?: number;
  days?: number;
}> {
  const profile = await requireSourcePnlAccess();
  try {
    const bundle = await readFacebookAdsBundle();
    if (!bundle.connection.connected) {
      return { ok: true, skipped: true };
    }
    const accessToken = await resolveAccessToken();
    const accounts = await listFacebookAdAccounts(accessToken);
    if (accounts.length === 0) {
      return { ok: false, error: "לא נמצאו חשבונות מודעות בפייסבוק" };
    }

    const to = jerusalemYmd();
    const fromDate = new Date(`${to}T00:00:00+03:00`);
    fromDate.setMonth(fromDate.getMonth() - 24);
    const from = jerusalemYmd(fromDate);

    const campaigns: { id: string; name: string; status: string }[] = [];
    const metrics: {
      campaignId: string;
      campaignName: string;
      day: string;
      cost: number;
      clicks: number;
      impressions: number;
    }[] = [];
    for (const account of accounts) {
      const listed = await listFacebookCampaigns(accessToken, account.id);
      for (const row of listed) {
        campaigns.push({
          id: row.id,
          name: row.name,
          status: row.status,
        });
      }
      const daily = await listFacebookDailyMetrics(accessToken, account.id, from, to);
      metrics.push(...daily);
    }

    const existingById = new Map(
      bundle.campaigns.map((row) => [row.facebookCampaignId, row]),
    );
    const now = new Date().toISOString();
    const mapRows = campaigns.map((row) => {
      const prev = existingById.get(row.id);
      return {
        facebook_campaign_id: row.id,
        facebook_campaign_name: row.name,
        status: row.status,
        source_name: prev?.sourceName ?? null,
        mapped_at: prev?.sourceName ? now : null,
        mapped_by: profile.id,
        updated_at: now,
      };
    });
    for (const extra of metrics) {
      if (mapRows.some((row) => row.facebook_campaign_id === extra.campaignId)) continue;
      const prev = existingById.get(extra.campaignId);
      mapRows.push({
        facebook_campaign_id: extra.campaignId,
        facebook_campaign_name: extra.campaignName,
        status: prev?.status || "UNKNOWN",
        source_name: prev?.sourceName ?? null,
        mapped_at: prev?.sourceName ? now : null,
        mapped_by: profile.id,
        updated_at: now,
      });
    }

    const admin = createAdminClient();
    for (let i = 0; i < mapRows.length; i += 300) {
      const { error } = await admin
        .from("facebook_ads_campaign_map")
        .upsert(mapRows.slice(i, i + 300), { onConflict: "facebook_campaign_id" });
      if (error) throw new Error(error.message);
    }

    const statRows = metrics.map((row) => ({
      facebook_campaign_id: row.campaignId,
      day: row.day,
      cost: row.cost,
      clicks: row.clicks,
      impressions: row.impressions,
    }));
    for (let i = 0; i < statRows.length; i += 400) {
      const { error } = await admin
        .from("facebook_ads_daily_stats")
        .upsert(statRows.slice(i, i + 400), { onConflict: "facebook_campaign_id,day" });
      if (error) throw new Error(error.message);
    }

    await admin.from("facebook_ads_settings").upsert({
      id: 1,
      ad_account_id: accounts.map((row) => row.id).join(","),
      ad_account_name: accounts.map((row) => row.name).join(" · "),
      last_synced_at: now,
      last_error: null,
      updated_by: profile.id,
      updated_at: now,
    });
    revalidatePath(SOURCE_PNL_PATH);
    return { ok: true, campaigns: campaigns.length, days: statRows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "סנכרון פייסבוק נכשל";
    await writeSettingsError(message);
    return { ok: false, error: message };
  }
}
