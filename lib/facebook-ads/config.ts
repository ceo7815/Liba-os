import { getSiteUrl } from "@/lib/env";

export function facebookGraphVersion(): string {
  const raw = process.env.FACEBOOK_GRAPH_VERSION?.trim() || "21.0";
  const digits = raw.replace(/^v/i, "") || "21.0";
  return `v${digits}`;
}

export const FACEBOOK_ADS_OAUTH_SCOPES = "ads_read,ads_management,business_management";

export function facebookAdsRedirectUri(): string {
  return `${getSiteUrl().replace(/\/$/, "")}/api/facebook-ads/callback`;
}

export function facebookAdsOAuthConfigured(): boolean {
  return Boolean(
    process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim(),
  );
}

export function envFacebookAccessToken(): string | null {
  const token = process.env.FACEBOOK_ACCESS_TOKEN?.trim();
  return token || null;
}

export function envFacebookAdAccountId(): string | null {
  const raw = process.env.FACEBOOK_AD_ACCOUNT_ID?.trim() ?? "";
  const id = raw.replace(/^act_/i, "").replace(/\D/g, "");
  return id || null;
}

export function actId(accountId: string): string {
  const digits = accountId.replace(/^act_/i, "").replace(/\D/g, "");
  return `act_${digits}`;
}
