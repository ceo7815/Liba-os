import type { FacebookAdsConnection } from "@/app/actions/facebook-ads";
import type { GoogleAdsConnection } from "@/app/actions/google-ads";
import { SOURCE_PNL_SNAPSHOT_KEY } from "@/lib/sales-dashboard/client-snapshot";
import type {
  DateRange,
  FacebookAdsCampaignRow,
  FacebookAdsDailyStat,
  GoogleAdsCampaignRow,
  GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";

export const SALES_ADS_CACHE_KEY = "liba-sales-by-source-ads";

export type CachedAdsBundle = {
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  googleSpendBySource: Record<string, number>;
  facebookAds: FacebookAdsConnection;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  facebookSpendBySource: Record<string, number>;
  range: DateRange;
};

let memory: CachedAdsBundle | null = null;

export function adsBundleHasStats(bundle: CachedAdsBundle | null | undefined): boolean {
  if (!bundle) return false;
  return bundle.googleStats.length > 0 || bundle.facebookStats.length > 0;
}

export function adsBundleUsable(bundle: CachedAdsBundle | null | undefined): boolean {
  if (!bundle) return false;
  return (
    Boolean(bundle.googleAds?.connected) ||
    Boolean(bundle.facebookAds?.connected) ||
    bundle.googleCampaigns.length > 0 ||
    bundle.facebookCampaigns.length > 0 ||
    adsBundleHasStats(bundle) ||
    Object.keys(bundle.googleSpendBySource).length > 0 ||
    Object.keys(bundle.facebookSpendBySource).length > 0
  );
}

export function rangeCoveredByCache(
  cached: DateRange | undefined,
  needed: DateRange,
): boolean {
  if (!cached) return false;
  if (!cached.from && !cached.to) return true;
  if (!needed.from && !needed.to) return !cached.from && !cached.to;
  if (cached.from && needed.from && needed.from < cached.from) return false;
  if (cached.to && needed.to && needed.to > cached.to) return false;
  return true;
}

export function readCachedAds(): CachedAdsBundle | null {
  if (memory && adsBundleUsable(memory)) return memory;
  if (typeof window === "undefined") return null;
  const fromSession = readJson(sessionStorage.getItem(SALES_ADS_CACHE_KEY));
  if (fromSession) {
    memory = fromSession;
    return fromSession;
  }
  const fromPnl = readFromSourcePnlSnapshot();
  if (fromPnl) {
    memory = fromPnl;
    return fromPnl;
  }
  return memory;
}

export function writeCachedAds(bundle: CachedAdsBundle): void {
  memory = bundle;
  if (typeof window === "undefined") return;
  const slim: CachedAdsBundle = {
    ...bundle,
    googleStats: bundle.googleStats,
    facebookStats: bundle.facebookStats,
  };
  try {
    sessionStorage.setItem(SALES_ADS_CACHE_KEY, JSON.stringify(slim));
  } catch {
    try {
      sessionStorage.setItem(
        SALES_ADS_CACHE_KEY,
        JSON.stringify({ ...slim, googleStats: [], facebookStats: [] }),
      );
    } catch {
      /* quota */
    }
  }
}

export function clearCachedAds(): void {
  memory = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SALES_ADS_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function readJson(raw: string | null): CachedAdsBundle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedAdsBundle;
    if (!parsed || typeof parsed !== "object") return null;
    const googleAds = parsed.googleAds
      ? { ...emptyGoogle(), ...parsed.googleAds }
      : emptyGoogle();
    const facebookAds = parsed.facebookAds
      ? { ...emptyFacebook(), ...parsed.facebookAds }
      : emptyFacebook();
    return {
      googleAds,
      googleCampaigns: Array.isArray(parsed.googleCampaigns)
        ? parsed.googleCampaigns
        : [],
      googleStats: Array.isArray(parsed.googleStats) ? parsed.googleStats : [],
      googleSpendBySource: parsed.googleSpendBySource ?? {},
      facebookAds,
      facebookCampaigns: Array.isArray(parsed.facebookCampaigns)
        ? parsed.facebookCampaigns
        : [],
      facebookStats: Array.isArray(parsed.facebookStats) ? parsed.facebookStats : [],
      facebookSpendBySource: parsed.facebookSpendBySource ?? {},
      range: parsed.range ?? { from: null, to: null },
    };
  } catch {
    return null;
  }
}

function emptyGoogle(): GoogleAdsConnection {
  return {
    oauthReady: false,
    developerTokenReady: false,
    connected: false,
    customerId: null,
    loginCustomerId: null,
    connectedEmail: null,
    lastSyncedAt: null,
    lastError: null,
    needsCustomerPick: false,
  };
}

function emptyFacebook(): FacebookAdsConnection {
  return {
    oauthReady: false,
    connected: false,
    adAccountId: null,
    adAccountName: null,
    connectedName: null,
    lastSyncedAt: null,
    lastError: null,
    needsAccountPick: false,
  };
}

function readFromSourcePnlSnapshot(): CachedAdsBundle | null {
  try {
    const raw =
      localStorage.getItem(SOURCE_PNL_SNAPSHOT_KEY) ??
      sessionStorage.getItem(SOURCE_PNL_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      googleAds?: GoogleAdsConnection;
      googleCampaigns?: GoogleAdsCampaignRow[];
      googleStats?: GoogleAdsDailyStat[];
      googleSpendBySource?: Record<string, number>;
      facebookAds?: FacebookAdsConnection;
      facebookCampaigns?: FacebookAdsCampaignRow[];
      facebookStats?: FacebookAdsDailyStat[];
      facebookSpendBySource?: Record<string, number>;
    };
    if (!parsed?.googleAds && !parsed?.facebookAds) return null;
    const bundle: CachedAdsBundle = {
      googleAds: { ...emptyGoogle(), ...parsed.googleAds },
      googleCampaigns: parsed.googleCampaigns ?? [],
      googleStats: parsed.googleStats ?? [],
      googleSpendBySource: parsed.googleSpendBySource ?? {},
      facebookAds: { ...emptyFacebook(), ...parsed.facebookAds },
      facebookCampaigns: parsed.facebookCampaigns ?? [],
      facebookStats: parsed.facebookStats ?? [],
      facebookSpendBySource: parsed.facebookSpendBySource ?? {},
      range: { from: null, to: null },
    };
    return adsBundleUsable(bundle) ? bundle : null;
  } catch {
    return null;
  }
}
