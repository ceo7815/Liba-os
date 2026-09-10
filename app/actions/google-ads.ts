"use server";

import { revalidatePath } from "next/cache";
import { requireSourcePnlAccess } from "@/lib/auth";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOOGLE_ADS_CUBE_SOURCE,
  jerusalemYmd,
  type DateRange,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import { encryptVaultSecret, decryptVaultSecret, hasVaultEncryptionKey } from "@/lib/vault/crypto";
import {
  envCustomerId,
  envLoginCustomerId,
  envRefreshToken,
  googleAdsDeveloperToken,
  googleAdsOAuthConfigured,
} from "@/lib/google-ads/config";
import {
  listAccessibleCustomerIds,
  listGoogleAdsCampaigns,
  listGoogleAdsDailyMetrics,
  refreshAccessToken,
} from "@/lib/google-ads/client";

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(
    message &&
      (/does not exist/i.test(message) || /schema cache/i.test(message) || /could not find/i.test(message)),
  );
}

export type GoogleAdsConnection = {
  oauthReady: boolean;
  developerTokenReady: boolean;
  connected: boolean;
  customerId: string | null;
  loginCustomerId: string | null;
  connectedEmail: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  needsCustomerPick: boolean;
};

export type GoogleAdsBundle = {
  connection: GoogleAdsConnection;
  campaigns: GoogleAdsCampaignRow[];
  stats: GoogleAdsDailyStat[];
};

const emptyConnection = (): GoogleAdsConnection => ({
  oauthReady: googleAdsOAuthConfigured(),
  developerTokenReady: Boolean(googleAdsDeveloperToken()),
  connected: false,
  customerId: null,
  loginCustomerId: null,
  connectedEmail: null,
  lastSyncedAt: null,
  lastError: null,
  needsCustomerPick: false,
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

async function fetchGoogleDailyStats(
  admin: ReturnType<typeof createAdminClient>,
  statsRange?: DateRange,
): Promise<
  {
    google_campaign_id: string;
    day: string;
    cost: number;
    clicks: number;
    impressions: number;
  }[]
> {
  const out: {
    google_campaign_id: string;
    day: string;
    cost: number;
    clicks: number;
    impressions: number;
  }[] = [];
  for (let from = 0; ; from += STATS_PAGE_SIZE) {
    let query = admin
      .from("google_ads_daily_stats")
      .select("google_campaign_id, day, cost, clicks, impressions")
      .order("day", { ascending: true })
      .order("google_campaign_id", { ascending: true })
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

export async function readGoogleAdsBundle(statsRange?: DateRange): Promise<GoogleAdsBundle> {
  const admin = createAdminClient();
  const [settings, maps, statsRows] = await Promise.all([
    admin
      .from("google_ads_settings")
      .select(
        "customer_id, login_customer_id, refresh_token_encrypted, connected_email, last_synced_at, last_error",
      )
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("google_ads_campaign_map")
      .select("google_campaign_id, google_campaign_name, status, source_name, enabled")
      .order("google_campaign_name"),
    fetchGoogleDailyStats(admin, statsRange),
  ]);

  if (
    isMissingRelation(settings.error?.message) ||
    isMissingRelation(maps.error?.message)
  ) {
    return { connection: emptyConnection(), campaigns: [], stats: [] };
  }
  if (maps.error) throw new Error(maps.error.message);
  if (settings.error && !isMissingRelation(settings.error.message)) {
    throw new Error(settings.error.message);
  }

  const row = settings.data;
  const envToken = envRefreshToken();
  const dbToken = Boolean(row?.refresh_token_encrypted);
  const customerId = envCustomerId() || row?.customer_id || null;
  const loginCustomerId = envLoginCustomerId() || row?.login_customer_id || null;
  const connected = Boolean(envToken || dbToken);

  return {
    connection: {
      oauthReady: googleAdsOAuthConfigured(),
      developerTokenReady: Boolean(googleAdsDeveloperToken()),
      connected,
      customerId,
      loginCustomerId,
      connectedEmail: row?.connected_email ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
      lastError: row?.last_error ?? null,
      needsCustomerPick: connected && !customerId,
    },
    campaigns: (maps.data ?? []).map((item) => ({
      googleCampaignId: String(item.google_campaign_id),
      googleCampaignName: item.google_campaign_name,
      status: item.status,
      sourceName: item.source_name,
      enabled: item.enabled !== false,
    })),
    stats: statsRows.map((item) => ({
      googleCampaignId: String(item.google_campaign_id),
      day: String(item.day).slice(0, 10),
      cost: Number(item.cost) || 0,
      clicks: Number(item.clicks) || 0,
      impressions: Number(item.impressions) || 0,
    })),
  };
}

async function resolveRefreshToken(): Promise<string> {
  const fromEnv = envRefreshToken();
  if (fromEnv) return fromEnv;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_ads_settings")
    .select("refresh_token_encrypted")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const encrypted = data?.refresh_token_encrypted;
  if (!encrypted) throw new Error("גוגל אדס לא מחובר");
  if (!hasVaultEncryptionKey()) {
    throw new Error("חסר מפתח הצפנה בשרת לפיענוח החיבור לגוגל");
  }
  return decryptVaultSecret(encrypted);
}

async function writeSettingsError(message: string) {
  const admin = createAdminClient();
  await admin.from("google_ads_settings").upsert({
    id: 1,
    last_error: message,
    updated_at: new Date().toISOString(),
  });
}

export async function saveGoogleAdsRefreshToken(refreshToken: string, email?: string | null) {
  if (!hasVaultEncryptionKey()) {
    throw new Error("חסר VAULT_ENCRYPTION_KEY להצפנת החיבור לגוגל");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("google_ads_settings").upsert({
    id: 1,
    refresh_token_encrypted: encryptVaultSecret(refreshToken),
    connected_email: email?.trim() || null,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listGoogleAdsAccounts(): Promise<{
  ok: boolean;
  accounts?: string[];
  error?: string;
}> {
  await requireSourcePnlAccess();
  try {
    const refreshToken = await resolveRefreshToken();
    const accessToken = await refreshAccessToken(refreshToken);
    const accounts = await listAccessibleCustomerIds(accessToken);
    return { ok: true, accounts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה";
    return { ok: false, error: message };
  }
}

export async function saveGoogleAdsCustomerId(
  customerId: string,
  loginCustomerId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const id = customerId.replace(/\D/g, "");
  if (id.length < 8) return { ok: false, error: "מזהה חשבון לא תקין" };
  const login =
    (loginCustomerId ?? "").replace(/\D/g, "") || envLoginCustomerId() || null;
  const admin = createAdminClient();
  const { error } = await admin.from("google_ads_settings").upsert({
    id: 1,
    customer_id: id,
    login_customer_id: login,
    last_error: null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function mapGoogleAdsCampaign(input: {
  googleCampaignId: string;
  sourceName: string;
  confirmReassign?: boolean;
}): Promise<{ ok: boolean; error?: string; currentSource?: string }> {
  const profile = await requireSourcePnlAccess();
  const googleCampaignId = input.googleCampaignId.trim();
  const sourceName = input.sourceName.trim();
  if (!googleCampaignId) return { ok: false, error: "חסר מזהה קמפיין" };
  if (!sourceName) return { ok: false, error: "חסר שם קוביה" };
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("google_ads_campaign_map")
    .select("source_name, google_campaign_name")
    .eq("google_campaign_id", googleCampaignId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "הקמפיין לא נמצא. סנכרנו מגוגל קודם." };
  const current = existing.source_name?.trim() || null;
  if (current && current !== sourceName && !input.confirmReassign) {
    return {
      ok: false,
      currentSource: current,
      error: `הקמפיין כבר משויך ל«${current}»`,
    };
  }
  const { error } = await admin
    .from("google_ads_campaign_map")
    .update({
      source_name: sourceName,
      mapped_by: profile.id,
      mapped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("google_campaign_id", googleCampaignId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function unmapGoogleAdsCampaign(
  googleCampaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSourcePnlAccess();
  const id = googleCampaignId.trim();
  if (!id) return { ok: false, error: "חסר מזהה קמפיין" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("google_ads_campaign_map")
    .update({
      source_name: null,
      mapped_at: null,
      mapped_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("google_campaign_id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function disconnectGoogleAds(): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const admin = createAdminClient();
  const { error } = await admin.from("google_ads_settings").upsert({
    id: 1,
    refresh_token_encrypted: null,
    connected_email: null,
    last_error: null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function syncGoogleAds(): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  campaigns?: number;
  days?: number;
}> {
  const profile = await requireSourcePnlAccess();
  try {
    const bundle = await readGoogleAdsBundle();
    if (!bundle.connection.connected) {
      return { ok: true, skipped: true };
    }
    if (!bundle.connection.developerTokenReady) {
      return { ok: false, error: "חסר GOOGLE_ADS_DEVELOPER_TOKEN בשרת" };
    }
    if (!bundle.connection.customerId) {
      return { ok: false, error: "בחרו חשבון גוגל אדס לחיבור" };
    }

    const refreshToken = await resolveRefreshToken();
    const accessToken = await refreshAccessToken(refreshToken);
    const customerId = bundle.connection.customerId;
    const loginCustomerId = bundle.connection.loginCustomerId || customerId;

    const campaigns = await listGoogleAdsCampaigns(accessToken, customerId, loginCustomerId);
    const to = jerusalemYmd();
    const fromDate = new Date(`${to}T00:00:00+03:00`);
    fromDate.setMonth(fromDate.getMonth() - 24);
    const from = jerusalemYmd(fromDate);
    const metrics = await listGoogleAdsDailyMetrics(
      accessToken,
      customerId,
      from,
      to,
      loginCustomerId,
    );

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const mapRows = campaigns.map((row) => ({
      google_campaign_id: row.id,
      google_campaign_name: row.name,
      status: row.status,
      source_name: GOOGLE_ADS_CUBE_SOURCE,
      mapped_at: now,
      mapped_by: profile.id,
      updated_at: now,
    }));
    for (const extra of metrics) {
      if (mapRows.some((row) => row.google_campaign_id === extra.campaignId)) continue;
      mapRows.push({
        google_campaign_id: extra.campaignId,
        google_campaign_name: extra.campaignName,
        status: "UNKNOWN",
        source_name: GOOGLE_ADS_CUBE_SOURCE,
        mapped_at: now,
        mapped_by: profile.id,
        updated_at: now,
      });
    }

    for (let i = 0; i < mapRows.length; i += 300) {
      const { error } = await admin
        .from("google_ads_campaign_map")
        .upsert(mapRows.slice(i, i + 300), { onConflict: "google_campaign_id" });
      if (error) throw new Error(error.message);
    }

    const statRows = metrics.map((row) => ({
      google_campaign_id: row.campaignId,
      day: row.day,
      cost: Math.round(row.cost * 100) / 100,
      clicks: row.clicks,
      impressions: row.impressions,
    }));
    for (let i = 0; i < statRows.length; i += 400) {
      const { error } = await admin
        .from("google_ads_daily_stats")
        .upsert(statRows.slice(i, i + 400), { onConflict: "google_campaign_id,day" });
      if (error) throw new Error(error.message);
    }

    await admin.from("google_ads_settings").upsert({
      id: 1,
      customer_id: customerId,
      login_customer_id: loginCustomerId,
      last_synced_at: now,
      last_error: null,
      updated_by: profile.id,
      updated_at: now,
    });
    revalidatePath(SOURCE_PNL_PATH);
    return { ok: true, campaigns: campaigns.length, days: statRows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "סנכרון גוגל אדס נכשל";
    await writeSettingsError(message);
    return { ok: false, error: message };
  }
}
