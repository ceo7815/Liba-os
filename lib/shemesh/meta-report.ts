import { listFacebookAdInsights, type FacebookAdDailyMetric } from "@/lib/facebook-ads/client";
import { envFacebookAccessToken } from "@/lib/facebook-ads/config";
import { DEFAULT_SHEMESH_AD_ACCOUNTS } from "@/lib/finance/brand-accounts";
import { decryptVaultSecret, hasVaultEncryptionKey } from "@/lib/vault/crypto";
import { jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicErrorText } from "@/lib/sync-log";

export type ShemeshMetaReport = {
  accountId: string;
  connected: boolean;
  error: string | null;
  rows: FacebookAdDailyMetric[];
  fetchedAt: string | null;
};

async function accessToken(): Promise<string | null> {
  const fromEnv = envFacebookAccessToken();
  if (fromEnv) return fromEnv;
  if (!hasVaultEncryptionKey()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("facebook_ads_settings")
    .select("access_token_encrypted")
    .eq("id", 1)
    .maybeSingle();
  const encrypted = data?.access_token_encrypted;
  if (!encrypted) return null;
  return decryptVaultSecret(encrypted);
}

export async function loadShemeshMetaReport(): Promise<ShemeshMetaReport> {
  const accountId = DEFAULT_SHEMESH_AD_ACCOUNTS[0];
  const empty = { accountId, connected: false, error: null as string | null, rows: [], fetchedAt: null };
  try {
    const token = await accessToken();
    if (!token) return { ...empty, error: "אין טוקן פייסבוק בשרת. הסנכרון של ליבה שומר אותו במסד." };
    const to = jerusalemYmd();
    const start = new Date(`${to}T00:00:00+03:00`);
    start.setDate(start.getDate() - 89);
    const from = jerusalemYmd(start);
    const rows = await listFacebookAdInsights(token, accountId, from, to);
    return { accountId, connected: true, error: null, rows, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = publicErrorText(error instanceof Error ? error.message : "פייסבוק לא זמין");
    console.error("[facebook-sync] shemesh ads failed", { accountId, message });
    return { ...empty, error: message };
  }
}
