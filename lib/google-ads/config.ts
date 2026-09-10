import { getSiteUrl } from "@/lib/env";

export function googleAdsApiVersion(): string {
  const raw = process.env.GOOGLE_ADS_API_VERSION?.trim() || "25";
  const digits = raw.replace(/^v/i, "").replace(/[^\d].*$/, "") || "25";
  return `v${digits}`;
}

export const GOOGLE_ADS_OAUTH_SCOPE = "https://www.googleapis.com/auth/adwords";

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function googleAdsRedirectUri(): string {
  return `${getSiteUrl().replace(/\/$/, "")}/api/google-ads/callback`;
}

export function googleAdsOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim(),
  );
}

export function googleAdsDeveloperToken(): string | null {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  return token || null;
}

export function envRefreshToken(): string | null {
  const token = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
  return token || null;
}

export function envCustomerId(): string | null {
  const id = digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID);
  return id || null;
}

export function envLoginCustomerId(): string | null {
  const id = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  return id || null;
}
