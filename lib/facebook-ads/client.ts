import {
  actId,
  facebookAdsOAuthConfigured,
  facebookGraphVersion,
} from "@/lib/facebook-ads/config";

type GraphJson = Record<string, unknown>;

export type FacebookAdAccount = {
  id: string;
  name: string;
};

export type FacebookCampaign = {
  id: string;
  name: string;
  status: string;
};

export type FacebookDailyMetric = {
  campaignId: string;
  campaignName: string;
  day: string;
  cost: number;
  clicks: number;
  impressions: number;
};

function asRecord(value: unknown): GraphJson {
  return value && typeof value === "object" ? (value as GraphJson) : {};
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(asString(value));
  return Number.isFinite(n) ? n : 0;
}

function graphError(json: GraphJson, status: number): string {
  const err = asRecord(json.error);
  return (
    asString(err.error_user_msg) ||
    asString(err.message) ||
    asString(json.message) ||
    `שגיאת פייסבוק (${status})`
  );
}

const GRAPH_FETCH_TIMEOUT_MS = 45_000;

async function graphFetch(
  path: string,
  accessToken: string,
  search: Record<string, string> = {},
): Promise<GraphJson> {
  const url = new URL(`https://graph.facebook.com/${facebookGraphVersion()}${path}`);
  if (accessToken) url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(search)) {
    if (value) url.searchParams.set(key, value);
  }
  const signal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(GRAPH_FETCH_TIMEOUT_MS)
      : undefined;
  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store", signal });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("פייסבוק לא הגיב בזמן — נסו שוב או סנכרנו מאוחר יותר");
    }
    throw err;
  }
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok || json.error) {
    throw new Error(graphError(json, res.status));
  }
  return json;
}

async function graphPages(
  path: string,
  accessToken: string,
  search: Record<string, string> = {},
): Promise<GraphJson[]> {
  const rows: GraphJson[] = [];
  let nextPath: string | null = path;
  let nextSearch = search;
  while (nextPath) {
    const json = await graphFetch(nextPath, accessToken, nextSearch);
    const data = Array.isArray(json.data) ? json.data : [];
    for (const row of data) rows.push(asRecord(row));
    const paging = asRecord(json.paging);
    const nextUrl = asString(paging.next);
    if (!nextUrl) break;
    const parsed = new URL(nextUrl);
    nextPath = parsed.pathname.replace(new RegExp(`^/${facebookGraphVersion()}`), "") || parsed.pathname;
    nextSearch = {};
    parsed.searchParams.forEach((value, key) => {
      if (key !== "access_token") nextSearch[key] = value;
    });
  }
  return rows;
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  if (!facebookAdsOAuthConfigured()) {
    throw new Error("חסרים FACEBOOK_APP_ID / FACEBOOK_APP_SECRET");
  }
  const json = await graphFetch("/oauth/access_token", "", {
    client_id: process.env.FACEBOOK_APP_ID!.trim(),
    client_secret: process.env.FACEBOOK_APP_SECRET!.trim(),
    redirect_uri: redirectUri,
    code,
  });
  const shortToken = asString(json.access_token);
  if (!shortToken) throw new Error("פייסבוק לא החזיר access token");
  return extendFacebookToken(shortToken);
}

export async function extendFacebookToken(shortToken: string): Promise<{
  accessToken: string;
  expiresAt: string | null;
}> {
  if (!facebookAdsOAuthConfigured()) {
    return { accessToken: shortToken, expiresAt: null };
  }
  try {
    const json = await graphFetch("/oauth/access_token", "", {
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID!.trim(),
      client_secret: process.env.FACEBOOK_APP_SECRET!.trim(),
      fb_exchange_token: shortToken,
    });
    const token = asString(json.access_token) || shortToken;
    const seconds = asNumber(json.expires_in);
    const expiresAt =
      seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
    return { accessToken: token, expiresAt };
  } catch {
    return { accessToken: shortToken, expiresAt: null };
  }
}

export async function facebookMeName(accessToken: string): Promise<string | null> {
  try {
    const json = await graphFetch("/me", accessToken, { fields: "name" });
    return asString(json.name) || null;
  } catch {
    return null;
  }
}

export async function listFacebookAdAccounts(
  accessToken: string,
): Promise<FacebookAdAccount[]> {
  const rows = await graphPages("/me/adaccounts", accessToken, {
    fields: "id,name,account_id,account_status",
    limit: "100",
  });
  return rows
    .map((row) => {
      const id = asString(row.account_id) || asString(row.id).replace(/^act_/i, "");
      return { id, name: asString(row.name) || id };
    })
    .filter((row) => row.id);
}

export async function listFacebookCampaigns(
  accessToken: string,
  adAccountId: string,
): Promise<FacebookCampaign[]> {
  const rows = await graphPages(`/${actId(adAccountId)}/campaigns`, accessToken, {
    fields: "id,name,status,effective_status",
    limit: "200",
  });
  return rows
    .map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      status: asString(row.effective_status) || asString(row.status) || "UNKNOWN",
    }))
    .filter((row) => row.id);
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

export async function listFacebookDailyMetrics(
  accessToken: string,
  adAccountId: string,
  from: string,
  to: string,
): Promise<FacebookDailyMetric[]> {
  const rows: GraphJson[] = [];
  for (const chunk of monthRanges(from, to)) {
    const part = await graphPages(`/${actId(adAccountId)}/insights`, accessToken, {
      level: "campaign",
      fields: "campaign_id,campaign_name,spend,clicks,impressions,date_start",
      time_increment: "1",
      time_range: JSON.stringify({ since: chunk.from, until: chunk.to }),
      limit: "500",
    });
    rows.push(...part);
  }
  return rows
    .map((row) => ({
      campaignId: asString(row.campaign_id),
      campaignName: asString(row.campaign_name),
      day: asString(row.date_start).slice(0, 10),
      cost: Math.round(asNumber(row.spend) * 100) / 100,
      clicks: Math.round(asNumber(row.clicks)),
      impressions: Math.round(asNumber(row.impressions)),
    }))
    .filter((row) => row.campaignId && /^\d{4}-\d{2}-\d{2}$/.test(row.day));
}
