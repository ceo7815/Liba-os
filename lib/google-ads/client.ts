import {
  digitsOnly,
  googleAdsApiVersion,
  googleAdsDeveloperToken,
} from "@/lib/google-ads/config";

export type GoogleAdsCampaign = {
  id: string;
  name: string;
  status: string;
};

export type GoogleAdsDailyMetric = {
  campaignId: string;
  campaignName: string;
  day: string;
  cost: number;
  clicks: number;
  impressions: number;
};

type AdsJson = Record<string, unknown>;

function asRecord(value: unknown): AdsJson {
  return value && typeof value === "object" ? (value as AdsJson) : {};
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(asString(value));
  return Number.isFinite(n) ? n : 0;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("חסרים GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok || !json.access_token) {
    throw new Error(
      asString(json.error_description) ||
        asString(json.error) ||
        "לא ניתן לרענן את החיבור לגוגל אדס",
    );
  }
  return asString(json.access_token);
}

export async function exchangeAuthCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("חסרים GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok || !json.refresh_token) {
    throw new Error(
      asString(json.error_description) ||
        asString(json.error) ||
        "גוגל לא החזיר refresh token. נסו שוב עם prompt=consent",
    );
  }
  return {
    refreshToken: asString(json.refresh_token),
    accessToken: asString(json.access_token),
  };
}

async function adsFetch(
  path: string,
  accessToken: string,
  init: { method?: string; body?: AdsJson; loginCustomerId?: string | null },
): Promise<AdsJson> {
  const developerToken = googleAdsDeveloperToken();
  if (!developerToken) {
    throw new Error("חסר GOOGLE_ADS_DEVELOPER_TOKEN בשרת");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const loginId = digitsOnly(init.loginCustomerId);
  if (loginId) headers["login-customer-id"] = loginId;

  const res = await fetch(
    `https://googleads.googleapis.com/${googleAdsApiVersion()}${path}`,
    {
      method: init.method ?? "POST",
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    },
  );
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) {
    const err = asRecord(json.error);
    const details = Array.isArray(err.details) ? err.details : [];
    const first = asRecord(details[0]);
    const message =
      asString(first.message) ||
      asString(err.message) ||
      asString(json.message) ||
      `שגיאת Google Ads (${res.status})`;
    throw new Error(message);
  }
  return json;
}

export async function listAccessibleCustomerIds(
  accessToken: string,
): Promise<string[]> {
  const json = await adsFetch("/customers:listAccessibleCustomers", accessToken, {
    method: "GET",
  });
  const names = Array.isArray(json.resourceNames) ? json.resourceNames : [];
  return names
    .map((name) => digitsOnly(asString(name).split("/").pop()))
    .filter(Boolean);
}

export async function searchGoogleAds(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string | null,
): Promise<AdsJson[]> {
  const id = digitsOnly(customerId);
  const rows: AdsJson[] = [];
  let pageToken = "";
  do {
    const body: AdsJson = { query };
    if (pageToken) body.pageToken = pageToken;
    const json = await adsFetch(`/customers/${id}/googleAds:search`, accessToken, {
      body,
      loginCustomerId: loginCustomerId || customerId,
    });
    const results = Array.isArray(json.results) ? json.results : [];
    for (const row of results) rows.push(asRecord(row));
    pageToken = asString(json.nextPageToken);
  } while (pageToken);
  return rows;
}

function monthRanges(from: string, to: string): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  if (!from || !to || from > to) return out;
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const mm = String(month).padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    out.push({
      from: start < from ? from : start,
      to: end > to ? to : end,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export async function listGoogleAdsCampaigns(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string | null,
): Promise<GoogleAdsCampaign[]> {
  const rows = await searchGoogleAds(
    accessToken,
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status
     FROM campaign
     ORDER BY campaign.name`,
    loginCustomerId,
  );
  return rows.map((row) => {
    const campaign = asRecord(row.campaign);
    return {
      id: asString(campaign.id),
      name: asString(campaign.name),
      status: asString(campaign.status) || "UNKNOWN",
    };
  }).filter((row) => row.id);
}

export async function listGoogleAdsDailyMetrics(
  accessToken: string,
  customerId: string,
  from: string,
  to: string,
  loginCustomerId?: string | null,
): Promise<GoogleAdsDailyMetric[]> {
  const rows: AdsJson[] = [];
  for (const chunk of monthRanges(from, to)) {
    const part = await searchGoogleAds(
      accessToken,
      customerId,
      `SELECT
          campaign.id,
          campaign.name,
          segments.date,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions
        FROM campaign
        WHERE segments.date BETWEEN '${chunk.from}' AND '${chunk.to}'`,
      loginCustomerId,
    );
    rows.push(...part);
  }
  return rows.map((row) => {
    const campaign = asRecord(row.campaign);
    const metrics = asRecord(row.metrics);
    const segments = asRecord(row.segments);
    return {
      campaignId: asString(campaign.id),
      campaignName: asString(campaign.name),
      day: asString(segments.date).slice(0, 10),
      cost: asNumber(metrics.costMicros) / 1_000_000,
      clicks: Math.round(asNumber(metrics.clicks)),
      impressions: Math.round(asNumber(metrics.impressions)),
    };
  }).filter((row) => row.campaignId && /^\d{4}-\d{2}-\d{2}$/.test(row.day));
}
