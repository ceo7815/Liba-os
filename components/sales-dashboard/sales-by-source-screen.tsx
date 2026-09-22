"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, PieChart, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { FacebookAdsConnection } from "@/app/actions/facebook-ads";
import type { GoogleAdsConnection } from "@/app/actions/google-ads";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { Money } from "@/components/marketing-dashboard/campaign-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  adsSourceBrand,
  assignOperatingBrand,
  matchesOperatingBrand,
  sourceNameVisibleInBrand,
} from "@/lib/finance/operating-brand";
import {
  DATE_PRESET_LABEL,
  DATE_PRESET_ORDER,
  GOOGLE_ADS_CUBE_SOURCE,
  GOOGLE_ADS_SHEMESH_CUBE_SOURCE,
  canonicalCampaignSource,
  facebookSpendBySource as rollupFacebookSpendBySource,
  formatIls,
  formatRangeDisplay,
  googleSpendBySource as rollupGoogleSpendBySource,
  isGoogleAdsCube,
  isoDay,
  rangeForPreset,
  resolveCampaignNames,
  spanOfIsoDates,
  type DatePreset,
  type DateRange,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import {
  adsBundleHasStats,
  adsBundleUsable,
  rangeCoveredByCache,
  readCachedAds,
  writeCachedAds,
  type CachedAdsBundle,
} from "@/lib/sales-dashboard/ads-cache";
import {
  buildSalesBySourceCube,
  formatSaleDateHe,
  isEmptySalesCube,
  isSaleProcess,
  namedSalesSource,
  saleDateOf,
  salePipelineStage,
  SALES_BY_SOURCE_MARGIN_THRESHOLD,
  SALES_STATUS_LABEL,
  sumSalesBySourceCubes,
  type SalesBySourceCube,
} from "@/lib/sales-dashboard/sales-by-source";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";

const EMPTY_GOOGLE: GoogleAdsConnection = {
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

const EMPTY_FACEBOOK: FacebookAdsConnection = {
  oauthReady: false,
  connected: false,
  adAccountId: null,
  adAccountName: null,
  connectedName: null,
  lastSyncedAt: null,
  lastError: null,
  needsAccountPick: false,
};

type CubeViewTab = "all" | "green" | "red" | "gray" | "hidden";

const CUBE_VIEW_TABS: { id: CubeViewTab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "green", label: "מעל 50%" },
  { id: "red", label: "מתחת ל-50%" },
  { id: "gray", label: "בלי יחס" },
  { id: "hidden", label: "ריקים" },
];

function ratioLabel(card: Pick<SalesBySourceCube, "percent" | "countedPremium">): string {
  if (card.percent != null) return `${card.percent}%`;
  if (card.countedPremium > 0) return "בלי שיווק";
  return "אין מכירות";
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

function normalizeGoogleCampaigns(rows: unknown[]): GoogleAdsCampaignRow[] {
  return asArray<Record<string, unknown>>(rows)
    .map((row) => {
      const googleCampaignId = String(
        row.googleCampaignId ?? row.google_campaign_id ?? "",
      ).trim();
      if (!googleCampaignId) return null;
      const source = row.sourceName ?? row.source_name;
      return {
        googleCampaignId,
        googleCampaignName: String(
          row.googleCampaignName ?? row.google_campaign_name ?? "",
        ),
        status: String(row.status ?? ""),
        sourceName: source == null || source === "" ? null : String(source),
        enabled: row.enabled !== false,
      } satisfies GoogleAdsCampaignRow;
    })
    .filter((row): row is GoogleAdsCampaignRow => Boolean(row));
}

function normalizeGoogleStats(rows: unknown[]): GoogleAdsDailyStat[] {
  return asArray<Record<string, unknown>>(rows)
    .map((row) => {
      const googleCampaignId = String(
        row.googleCampaignId ?? row.google_campaign_id ?? "",
      ).trim();
      const day = isoDay(row.day);
      if (!googleCampaignId || !day) return null;
      return {
        googleCampaignId,
        day,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        leads: Number(row.leads) || 0,
      } satisfies GoogleAdsDailyStat;
    })
    .filter((row): row is GoogleAdsDailyStat => Boolean(row));
}

function normalizeFacebookCampaigns(rows: unknown[]): FacebookAdsCampaignRow[] {
  return asArray<Record<string, unknown>>(rows)
    .map((row) => {
      const facebookCampaignId = String(
        row.facebookCampaignId ?? row.facebook_campaign_id ?? "",
      ).trim();
      if (!facebookCampaignId) return null;
      const source = row.sourceName ?? row.source_name;
      return {
        facebookCampaignId,
        facebookCampaignName: String(
          row.facebookCampaignName ?? row.facebook_campaign_name ?? "",
        ),
        status: String(row.status ?? ""),
        sourceName: source == null || source === "" ? null : String(source),
        enabled: row.enabled !== false,
      } satisfies FacebookAdsCampaignRow;
    })
    .filter((row): row is FacebookAdsCampaignRow => Boolean(row));
}

function normalizeFacebookStats(rows: unknown[]): FacebookAdsDailyStat[] {
  return asArray<Record<string, unknown>>(rows)
    .map((row) => {
      const facebookCampaignId = String(
        row.facebookCampaignId ?? row.facebook_campaign_id ?? "",
      ).trim();
      const day = isoDay(row.day);
      if (!facebookCampaignId || !day) return null;
      return {
        facebookCampaignId,
        day,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        leads: Number(row.leads) || 0,
      } satisfies FacebookAdsDailyStat;
    })
    .filter((row): row is FacebookAdsDailyStat => Boolean(row));
}

function asSpendMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(amount);
    if (key && Number.isFinite(n) && n !== 0) out[canonicalCampaignSource(key)] = n;
  }
  return out;
}

export function SalesBySourceScreen() {
  const { brand, shemeshEmployeeNames } = useOperatingBrand();
  const { dashboard: liveDashboard, ready: liveReady } = useLiveDashboard();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [preset, setPreset] = useState<DatePreset>("ytd");
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });
  const [cubeView, setCubeView] = useState<CubeViewTab>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [googleAds, setGoogleAds] = useState<GoogleAdsConnection>(EMPTY_GOOGLE);
  const [googleCampaigns, setGoogleCampaigns] = useState<GoogleAdsCampaignRow[]>(
    [],
  );
  const [googleStats, setGoogleStats] = useState<GoogleAdsDailyStat[]>([]);
  const [googleSpendBySource, setGoogleSpendBySource] = useState<
    Record<string, number>
  >({});
  const [facebookAds, setFacebookAds] = useState<FacebookAdsConnection>(
    EMPTY_FACEBOOK,
  );
  const [facebookCampaigns, setFacebookCampaigns] = useState<
    FacebookAdsCampaignRow[]
  >([]);
  const [facebookStats, setFacebookStats] = useState<FacebookAdsDailyStat[]>(
    [],
  );
  const [facebookSpendBySource, setFacebookSpendBySource] = useState<
    Record<string, number>
  >({});
  const [adsReady, setAdsReady] = useState(false);
  const [quietRefreshing, setQuietRefreshing] = useState(false);
  const rangeRef = useRef(rangeForPreset("ytd", { from: null, to: null }));

  const range = useMemo(() => rangeForPreset(preset, custom), [preset, custom]);
  rangeRef.current = range;

  const applyAds = useCallback((bundle: CachedAdsBundle, persist = true) => {
    const google = bundle.googleAds ?? EMPTY_GOOGLE;
    const facebook = bundle.facebookAds ?? EMPTY_FACEBOOK;
    const next: CachedAdsBundle = {
      googleAds: google,
      googleCampaigns: normalizeGoogleCampaigns(bundle.googleCampaigns),
      googleStats: normalizeGoogleStats(bundle.googleStats),
      googleSpendBySource: asSpendMap(bundle.googleSpendBySource),
      facebookAds: facebook,
      facebookCampaigns: normalizeFacebookCampaigns(bundle.facebookCampaigns),
      facebookStats: normalizeFacebookStats(bundle.facebookStats),
      facebookSpendBySource: asSpendMap(bundle.facebookSpendBySource),
      range: bundle.range,
    };
    setGoogleAds(next.googleAds);
    setGoogleCampaigns(next.googleCampaigns);
    setGoogleStats(next.googleStats);
    setGoogleSpendBySource(next.googleSpendBySource);
    setFacebookAds(next.facebookAds);
    setFacebookCampaigns(next.facebookCampaigns);
    setFacebookStats(next.facebookStats);
    setFacebookSpendBySource(next.facebookSpendBySource);
    setAdsReady(adsBundleUsable(next));
    if (persist) writeCachedAds(next);
  }, []);

  useLayoutEffect(() => {
    const cached = readCachedAds();
    if (!cached) return;
    applyAds(cached, false);
  }, [applyAds]);

  useEffect(() => {
    if (!liveDashboard) return;
    setData((current) => {
      const incoming = liveDashboard.marketing?.productions?.length ?? 0;
      const have = current?.marketing?.productions?.length ?? 0;
      if (incoming === 0 && have > 0) return current;
      if (have > 50 && incoming < Math.max(50, Math.floor(have * 0.5))) {
        return current;
      }
      return liveDashboard;
    });
    setLoadState("ok");
  }, [liveDashboard]);

  const loadAds = useCallback(
    async (statsRange: DateRange) => {
      const params = new URLSearchParams({ t: String(Date.now()) });
      if (statsRange?.from) params.set("from", statsRange.from);
      if (statsRange?.to) params.set("to", statsRange.to);
      const res = await fetch(`/api/marketing-finance?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? "אין הרשאה לשיווק" : "טעינת שיווק נכשלה");
      }
      const bundle = (await res.json()) as CachedAdsBundle & { error?: string };
      if (bundle.error) toast.error(bundle.error);
      applyAds(
        {
          googleAds: bundle.googleAds ?? EMPTY_GOOGLE,
          googleCampaigns: bundle.googleCampaigns ?? [],
          googleStats: bundle.googleStats ?? [],
          googleSpendBySource: bundle.googleSpendBySource ?? {},
          facebookAds: bundle.facebookAds ?? EMPTY_FACEBOOK,
          facebookCampaigns: bundle.facebookCampaigns ?? [],
          facebookStats: bundle.facebookStats ?? [],
          facebookSpendBySource: bundle.facebookSpendBySource ?? {},
          range: statsRange,
        },
        true,
      );
    },
    [applyAds],
  );

  useEffect(() => {
    const cached = readCachedAds();
    if (
      cached &&
      adsBundleHasStats(cached) &&
      rangeCoveredByCache(cached.range, range)
    ) {
      return;
    }
    let cancelled = false;
    const alreadyShowing = adsBundleUsable(cached);
    if (!alreadyShowing) setQuietRefreshing(true);
    void loadAds(rangeRef.current)
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "טעינת שיווק נכשלה");
          setAdsReady(true);
        }
      })
      .finally(() => {
        if (!cancelled) setQuietRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAds, range.from, range.to]);

  useEffect(() => {
    const onSync = () => {
      setQuietRefreshing(true);
      void loadAds(rangeRef.current)
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : "טעינת שיווק נכשלה");
          setAdsReady(true);
        })
        .finally(() => setQuietRefreshing(false));
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onSync);
  }, [loadAds]);

  useEffect(() => {
    if (data || !liveReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/sales-dashboard?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(res.status === 401 ? "אין הרשאה" : "שגיאת טעינה");
        const next = (await res.json()) as DashboardData;
        if (!cancelled) {
          setData(next);
          setLoadState("ok");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, liveReady]);

  const productions = useMemo(() => {
    const rows = data?.marketing?.productions ?? [];
    return rows.filter((row) => {
      if (!isSaleProcess(row.process)) return false;
      return matchesOperatingBrand(
        assignOperatingBrand({
          agent: row.agent,
          source: row.source,
          shemeshEmployeeNames,
        }),
        brand,
      );
    });
  }, [data?.marketing?.productions, brand, shemeshEmployeeNames]);

  const sourceNames = useMemo(() => {
    const names = new Set<string>();
    const productionNames = new Set<string>();
    for (const row of productions) {
      const name = namedSalesSource(row.source);
      names.add(name);
      productionNames.add(name);
    }
    const consider = (raw: string) => {
      const canon = canonicalCampaignSource(raw);
      if (!canon) return;
      if (sourceNameVisibleInBrand(canon, brand, productionNames.has(canon))) {
        names.add(canon);
      }
    };
    for (const row of data?.marketing?.sources ?? []) consider(row.name);
    for (const name of data?.marketing?.sourceCatalog ?? []) consider(name);
    if (brand === "all" || brand === "liba") names.add(GOOGLE_ADS_CUBE_SOURCE);
    if (brand === "all" || brand === "shemesh") names.add(GOOGLE_ADS_SHEMESH_CUBE_SOURCE);
    for (const row of facebookCampaigns) consider(row.sourceName ?? "");
    return Array.from(names);
  }, [
    productions,
    data?.marketing?.sources,
    data?.marketing?.sourceCatalog,
    facebookCampaigns,
    brand,
  ]);

  const campaignNames = useMemo(
    () => resolveCampaignNames(sourceNames, []),
    [sourceNames],
  );

  const googleSpendResolved = useMemo(() => {
    const computed = rollupGoogleSpendBySource(googleCampaigns, googleStats, range);
    return Object.keys(computed).length > 0 ? computed : googleSpendBySource;
  }, [googleCampaigns, googleStats, range, googleSpendBySource]);

  const facebookSpendResolved = useMemo(() => {
    const computed = rollupFacebookSpendBySource(
      facebookCampaigns,
      facebookStats,
      range,
    );
    return Object.keys(computed).length > 0 ? computed : facebookSpendBySource;
  }, [facebookCampaigns, facebookStats, range, facebookSpendBySource]);

  const allCards = useMemo(
    () =>
      campaignNames
        .map((name) => {
          const includeFacebookAds = matchesOperatingBrand(
            adsSourceBrand(name),
            brand,
          );
          const includeGoogleAds = isGoogleAdsCube(name) || includeFacebookAds;
          return buildSalesBySourceCube({
            name,
            productions,
            range,
            googleCampaigns,
            googleStats,
            googleSpendBySource: googleSpendResolved,
            facebookCampaigns,
            facebookStats,
            facebookSpendBySource: facebookSpendResolved,
            includeGoogleAds,
            includeFacebookAds,
          });
        })
        .sort(
          (a, b) =>
            b.countedPremium - a.countedPremium ||
            b.adsTotal - a.adsTotal ||
            a.name.localeCompare(b.name, "he"),
        ),
    [
      campaignNames,
      productions,
      range,
      googleCampaigns,
      googleStats,
      googleSpendResolved,
      facebookCampaigns,
      facebookStats,
      facebookSpendResolved,
      brand,
    ],
  );

  const cubeBuckets = useMemo(() => {
    const byPremium = (a: SalesBySourceCube, b: SalesBySourceCube) =>
      b.countedPremium - a.countedPremium ||
      (a.percent ?? 9999) - (b.percent ?? 9999) ||
      b.adsTotal - a.adsTotal;
    const withSales = allCards
      .filter((card) => !isEmptySalesCube(card) && card.countedPremium > 0)
      .sort(byPremium);
    const adsOnly = allCards
      .filter(
        (card) =>
          !isEmptySalesCube(card) &&
          card.countedPremium <= 0 &&
          card.adsTotal > 0,
      )
      .sort((a, b) => b.adsTotal - a.adsTotal);
    const gray = allCards.filter(
      (card) =>
        !isEmptySalesCube(card) &&
        card.countedPremium <= 0 &&
        card.adsTotal <= 0,
    );
    const hidden = allCards.filter((card) => isEmptySalesCube(card));
    const green = withSales.filter((card) => card.tone === "green");
    const red = [...withSales, ...adsOnly].filter((card) => card.tone === "red");
    return {
      green,
      red,
      gray,
      hidden,
      active: [...withSales, ...adsOnly, ...gray],
    };
  }, [allCards]);

  const visibleCards = useMemo(() => {
    if (cubeView === "green") return cubeBuckets.green;
    if (cubeView === "red") return cubeBuckets.red;
    if (cubeView === "gray") return cubeBuckets.gray;
    if (cubeView === "hidden") return cubeBuckets.hidden;
    return cubeBuckets.active;
  }, [cubeView, cubeBuckets]);

  const cubeViewCounts = {
    all: cubeBuckets.active.length,
    green: cubeBuckets.green.length,
    red: cubeBuckets.red.length,
    gray: cubeBuckets.gray.length,
    hidden: cubeBuckets.hidden.length,
  };

  const totals = useMemo(
    () => sumSalesBySourceCubes(cubeBuckets.active),
    [cubeBuckets.active],
  );

  const dataSpan = useMemo(
    () =>
      spanOfIsoDates([
        ...productions.map((row) => saleDateOf(row)),
        ...googleStats.map((row) => row.day),
        ...facebookStats.map((row) => row.day),
      ]),
    [productions, googleStats, facebookStats],
  );

  const unmappedFacebookCount = useMemo(
    () =>
      facebookCampaigns.filter((row) => row.enabled && !row.sourceName?.trim())
        .length,
    [facebookCampaigns],
  );

  const selectedCard = allCards.find((card) => card.name === selected) ?? null;
  const rangeLabel = formatRangeDisplay(preset, range, dataSpan);

  return (
    <section className="mx-auto w-full max-w-[72rem] space-y-3.5 sm:space-y-6">
      <header className="dash-enter px-0.5 sm:px-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
          מכירות · צנורת לפי מקור הפנייה
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-highlight/35 sm:size-10">
                <PieChart className="size-4 sm:size-5" />
              </span>
              <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight sm:text-3xl sm:leading-none">
                מכירות לפי מקור
              </h1>
            </div>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
              כמה פרמיה נמכרה מול הוצאות השיווק של כל מקור — גם לפני שהופקה.
              האחוז = פרמיה ÷ שיווק. מתחת ל־50% הפסד באדום, מעל 50% ירוק.
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground sm:hidden">
              פרמיה ÷ שיווק · מתחת ל־50% הפסד
            </p>
          </div>
          <LastSyncPanel
            excelLabel={
              data?.source === "live"
                ? formatLastUpdatedAt(data.syncedAt)
                : data
                  ? "מצב הדגמה"
                  : null
            }
            googleLabel={
              googleAds.connected
                ? formatLastUpdatedAt(googleAds.lastSyncedAt) ?? "מחובר · טרם סונכרן"
                : null
            }
            facebookLabel={
              facebookAds.connected
                ? formatLastUpdatedAt(facebookAds.lastSyncedAt) ??
                  "מחובר · טרם סונכרן"
                : null
            }
            liveUpdating={quietRefreshing}
            showingCached={!adsReady && !quietRefreshing}
          />
        </div>
      </header>

      <div
        className="dash-enter relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:p-5"
        style={{ animationDelay: "40ms" }}
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {DATE_PRESET_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                preset === key
                  ? "bg-black text-white"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {DATE_PRESET_LABEL[key]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
          <span className="text-sm font-semibold tracking-tight">
            {DATE_PRESET_LABEL[preset]}
          </span>
          <span
            dir="ltr"
            className="text-[12px] font-medium tabular-nums text-muted-foreground sm:text-sm"
          >
            {rangeLabel}
          </span>
        </div>
        {preset === "custom" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Input
              type="date"
              className="h-11 w-full rounded-xl border-black/[0.06] sm:h-10 sm:w-40"
              value={custom.from ?? ""}
              onChange={(e) =>
                setCustom((prev) => ({ ...prev, from: e.target.value || null }))
              }
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">עד</span>
            <Input
              type="date"
              className="h-11 w-full rounded-xl border-black/[0.06] sm:h-10 sm:w-40"
              value={custom.to ?? ""}
              onChange={(e) =>
                setCustom((prev) => ({ ...prev, to: e.target.value || null }))
              }
            />
          </div>
        ) : null}

        <div className="-mx-1 mt-3.5 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:mt-4 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {data?.source === "live" ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500" />
              אקסל דוח מנהלים מחובר
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
              <span className="size-2 rounded-full bg-amber-500" />
              אקסל — אין סנכרון
            </span>
          )}
          {googleAds.connected ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold",
                googleAds.lastError
                  ? "bg-red-50 text-red-800"
                  : "bg-emerald-50 text-emerald-800",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  googleAds.lastError ? "bg-red-500" : "bg-emerald-500",
                )}
              />
              {googleAds.lastError ? "סנכרון גוגל נכשל" : "גוגל אדס מחובר"}
            </span>
          ) : null}
          {facebookAds.connected ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold",
                facebookAds.lastError
                  ? "bg-red-50 text-red-800"
                  : "bg-emerald-50 text-emerald-800",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  facebookAds.lastError ? "bg-red-500" : "bg-emerald-500",
                )}
              />
              {facebookAds.lastError ? "סנכרון פייסבוק נכשל" : "פייסבוק מחובר"}
            </span>
          ) : null}
        </div>
      </div>

      {allCards.length > 0 ? (
        <div
          className="dash-enter grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7"
          style={{ animationDelay: "80ms" }}
        >
          <SummaryStat
            label="מכירות"
            value={(totals.countedCount ?? 0).toLocaleString("he-IL")}
          />
          <SummaryStat
            label="עוד לא הופקו"
            value={(totals.pendingCount ?? 0).toLocaleString("he-IL")}
          />
          <SummaryStat
            label="נשלמו"
            value={(totals.activatedCount ?? 0).toLocaleString("he-IL")}
          />
          <SummaryStat
            label="פרמיה ממתינה"
            value={formatIls(totals.pendingPremium ?? 0)}
          />
          <SummaryStat
            label="פרמיה"
            value={formatIls(totals.countedPremium ?? 0)}
          />
          <SummaryStat
            label="שיווק ופרסום"
            value={adsReady ? formatIls(totals.adsTotal) : "טוען…"}
          />
          <SummaryStat
            label="% פרמיה מול שיווק"
            value={
              adsReady
                ? totals.percent != null
                  ? `${totals.percent}%`
                  : totals.countedPremium > 0
                    ? "בלי שיווק"
                    : "אין יחס"
                : "טוען…"
            }
            emphasize={
              adsReady
                ? totals.tone === "green"
                  ? "profit"
                  : totals.tone === "red"
                    ? "loss"
                    : undefined
                : undefined
            }
          />
        </div>
      ) : null}

      {!adsReady && data?.source === "live" ? (
        <div className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:rounded-[var(--radius)]">
          טוענים הוצאות גוגל ופייסבוק. הצנורת מהאקסל כבר מוצגת — אל תסתמכו על ₪0
          בשיווק עד שהמספר מתעדכן.
        </div>
      ) : null}

      {unmappedFacebookCount > 0 ? (
        <div className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:rounded-[var(--radius)]">
          {unmappedFacebookCount} קמפיינים בפייסבוק בלי שיוך למקור — השיוך נעשה
          ברווח והפסד לפי מקור.
        </div>
      ) : null}

      {allCards.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {CUBE_VIEW_TABS.map((tab) => {
            const selectedTab = cubeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCubeView(tab.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                  selectedTab && tab.id === "all" && "bg-black text-white",
                  selectedTab && tab.id === "green" && "bg-emerald-700 text-white",
                  selectedTab && tab.id === "red" && "bg-red-700 text-white",
                  selectedTab && tab.id === "gray" && "bg-zinc-500 text-white",
                  selectedTab && tab.id === "hidden" && "bg-zinc-600 text-white",
                  !selectedTab && "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {tab.label}
                <span className="ms-1.5 tabular-nums opacity-80">
                  {cubeViewCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {allCards.length === 0 ? (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          {loadState === "error" && !data
            ? "לא ניתן לטעון את דוח המנהלים."
            : data
              ? "אין מכירות לפי מקור בטווח הזה."
              : "טוען מכירות מהאקסל…"}
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          אין מקורות בתצוגה הזו.
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => (
            <SourceCube
              key={card.name}
              card={card}
              rangeLabel={rangeLabel}
              adsReady={adsReady}
              onOpen={() => setSelected(card.name)}
            />
          ))}
        </div>
      )}

      <SalesSourceDialog
        card={selectedCard}
        rangeLabel={rangeLabel}
        adsReady={adsReady}
        open={Boolean(selectedCard)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </section>
  );
}

function SourceCube({
  card,
  rangeLabel,
  adsReady,
  onOpen,
}: {
  card: SalesBySourceCube;
  rangeLabel: string;
  adsReady: boolean;
  onOpen: () => void;
}) {
  const accent =
    card.tone === "green"
      ? "bg-emerald-500"
      : card.tone === "red"
        ? "bg-red-500"
        : "bg-zinc-300";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-[1.25rem] border p-4 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-[transform,background-color,border-color] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:p-5",
        adsReady && card.tone === "green" && "border-emerald-300 bg-emerald-50 hover:border-emerald-400",
        adsReady && card.tone === "red" && "border-red-300 bg-red-50 hover:border-red-400",
        (!adsReady || card.tone === "gray") &&
          "border-black/[0.06] bg-white hover:border-black/10 hover:bg-[#fffcf0]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 start-0 w-1 origin-top scale-y-100 transition-transform duration-300 group-hover:scale-y-110",
          accent,
        )}
      />
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight sm:text-base">
            {card.name}
          </h2>
          <p dir="ltr" className="mt-1 text-[11px] text-muted-foreground">
            {rangeLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {card.pendingCount} עוד לא הופקו · {card.activatedCount} נשלמו
            {card.leakedCount ? ` · ${card.leakedCount} נפלו` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ChevronLeft className="size-4 text-black/25 transition-transform group-hover:-translate-x-0.5" />
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-[13px]">
        <CubeRow
          label="פרמיה ממתינה"
          value={<Money value={card.pendingPremium} className="font-medium tabular-nums" />}
        />
        <CubeRow
          label="פרמיה שהופקה"
          value={<Money value={card.activatedPremium} className="font-medium tabular-nums" />}
        />
        <CubeRow
          label="פרמיה"
          value={<Money value={card.countedPremium} className="font-medium tabular-nums" />}
        />
        <CubeRow
          label="שיווק ופרסום"
          value={
            adsReady ? (
              <Money value={card.adsTotal} minus className="font-medium tabular-nums" />
            ) : (
              <span className="font-medium text-muted-foreground">טוען…</span>
            )
          }
        />
      </div>

      <div className="mt-auto flex min-h-12 w-full items-end justify-between gap-3 border-t border-black/[0.06] pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">% פרמיה מול שיווק</p>
        <p
          className={cn(
            "text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-2xl",
            adsReady && card.tone === "green" && "text-emerald-700",
            adsReady && card.tone === "red" && "text-red-700",
            (!adsReady || card.tone === "gray") && "text-muted-foreground",
          )}
        >
          {adsReady ? ratioLabel(card) : "טוען…"}
        </p>
      </div>
    </div>
  );
}

function SalesSourceDialog({
  card,
  rangeLabel,
  adsReady,
  open,
  onOpenChange,
}: {
  card: SalesBySourceCube | null;
  rangeLabel: string;
  adsReady: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const percent = card ? ratioLabel(card) : "אין יחס";
  const thresholdPct = Math.round(SALES_BY_SOURCE_MARGIN_THRESHOLD * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card?.name ?? "מקור"}</DialogTitle>
          <DialogDescription>
            {rangeLabel} · מכירה אחת · % = פרמיה ÷ שיווק
          </DialogDescription>
        </DialogHeader>
        {card ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-black/[0.06] bg-[#fffcf0]/50 px-4 py-3.5">
              <h3 className="text-sm font-semibold tracking-tight">איך הקוביה מחושבת</h3>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  רק סוג תהליך «מכירה». פרמיה ממתינה = עוד לא הופקה (בתהליך
                  הפקה, חוסרים, חיתום). פרמיה שהופקה = מכירה שנשלמה (פעילה). לא
                  מחברים מינוי.
                </li>
                <li>תאריך: העברה ליצרן. אם אין העברה, תחילת ביטוח.</li>
                <li>
                  פרמיה {formatIls(card.countedPremium)} = עוד לא הופקה{" "}
                  {formatIls(card.pendingPremium)} ({card.pendingCount}) + נשלמה{" "}
                  {formatIls(card.activatedPremium)} ({card.activatedCount}). כל
                  שורה פעם אחת.
                </li>
                <li>
                  שיווק {adsReady ? formatIls(card.adsTotal) : "טוען…"} = גוגל{" "}
                  {adsReady ? formatIls(card.googleAds) : "—"} + פייסבוק{" "}
                  {adsReady ? formatIls(card.facebookAds) : "—"}. בלי שכר, בלי מכפיל.
                </li>
                <li>
                  האחוז = פרמיה ÷ שיווק. דוגמה: פרמיה ₪2,000 ושיווק ₪4,000 = 50%.
                  מתחת ל־{thresholdPct}% זה הפסד (אדום). מעל {thresholdPct}% ירוק.
                  {adsReady && card.adsTotal > 0
                    ? ` כאן ${formatIls(card.countedPremium)} ÷ ${formatIls(card.adsTotal)} = ${percent}.`
                    : adsReady
                      ? " בלי שיווק אין יחס."
                      : ""}
                </li>
              </ul>
            </section>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="מכירות" value={String(card.countedCount)} />
              <MiniStat label="עוד לא הופקו" value={String(card.pendingCount)} />
              <MiniStat label="נשלמו" value={String(card.activatedCount)} />
              <MiniStat label="פרמיה ממתינה" value={formatIls(card.pendingPremium)} />
              <MiniStat label="פרמיה שהופקה" value={formatIls(card.activatedPremium)} />
              <MiniStat label="פרמיה" value={formatIls(card.countedPremium)} />
              <MiniStat
                label="שיווק ופרסום"
                value={adsReady ? formatIls(card.adsTotal) : "טוען…"}
              />
              <MiniStat label="% פרמיה מול שיווק" value={adsReady ? percent : "טוען…"} />
            </div>

            {adsReady && card.adsLines.length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold tracking-tight">קמפיינים שיווקיים</h3>
                <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.06]">
                  {card.adsLines.map((line) => (
                    <li
                      key={`${line.channel}-${line.name}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {line.channel === "google" ? "גוגל" : "פייסבוק"}
                        </span>
                        {" · "}
                        {line.name}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatIls(line.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {card.agents.length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold tracking-tight">מי מכר</h3>
                <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.06]">
                  {card.agents.map((agent) => (
                    <li
                      key={agent.agent}
                      className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{agent.agent}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {agent.pendingCount
                            ? `${agent.pendingCount} עוד לא הופקו`
                            : ""}
                          {agent.pendingCount && agent.activatedCount ? " · " : ""}
                          {agent.activatedCount
                            ? `${agent.activatedCount} נשלמו`
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatIls(agent.premium)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold tracking-tight">מה ומתי</h3>
              {card.rows.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-black/[0.08] px-4 py-6 text-center text-sm text-muted-foreground">
                  אין שורות בטווח.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.06]">
                  {card.rows.map((row) => (
                    <PipelineRow key={row.key} row={row} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PipelineRow({ row }: { row: MarketingProduction }) {
  const stage = salePipelineStage(row);
  const tone =
    stage === "active"
      ? "bg-emerald-50 text-emerald-800"
      : stage === "cancelled"
        ? "bg-red-50 text-red-800"
        : "bg-amber-50 text-amber-900";
  const when = formatSaleDateHe(row);
  const dateHint =
    when.kind === "start" ? "תחילת ביטוח" : when.kind === "transfer" ? "העברה ליצרן" : "";
  const chip =
    stage === "active"
      ? SALES_STATUS_LABEL.active
      : stage === "cancelled"
        ? SALES_STATUS_LABEL.cancelled
        : row.statusRaw && row.statusRaw !== "—"
          ? row.statusRaw
          : SALES_STATUS_LABEL.pending;
  return (
    <li className="flex flex-col gap-1 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
            {chip}
          </span>
          <p className="truncate text-sm font-medium">{row.client}</p>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {row.agent} · {row.product}
        </p>
      </div>
      <div className="shrink-0 text-start sm:text-end">
        <p className="text-sm font-semibold tabular-nums">{formatIls(row.premium)}</p>
        <p className="text-[11px] text-muted-foreground">
          <span dir="ltr" className="tabular-nums">
            {when.day}
          </span>
          {dateHint ? ` · ${dateHint}` : ""}
        </p>
      </div>
    </li>
  );
}

function CubeRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] leading-snug text-muted-foreground sm:text-[13px]">
        {label}
      </span>
      <div className="min-w-0 truncate text-end text-[13px]">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#fffcf0]/40 px-3 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: "profit" | "loss";
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.15rem] border border-black/[0.06] bg-white px-2.5 py-2.5 text-center shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:px-3.5 sm:py-3.5">
      <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-[13px] font-semibold leading-tight tracking-tight tabular-nums sm:mt-1.5 sm:text-[15px]",
          emphasize === "profit" && "text-emerald-700",
          emphasize === "loss" && "text-red-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LastSyncPanel({
  excelLabel,
  googleLabel,
  facebookLabel,
  liveUpdating,
  showingCached,
}: {
  excelLabel: string | null;
  googleLabel: string | null;
  facebookLabel: string | null;
  liveUpdating: boolean;
  showingCached: boolean;
}) {
  return (
    <div className="w-full rounded-[1.25rem] border border-black/[0.06] bg-white px-3 py-2.5 text-xs shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:min-w-[18rem] sm:rounded-[var(--radius)] sm:px-3.5 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-foreground">
          עדכון אחרון
        </p>
        {liveUpdating ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <RefreshCw className="size-3 animate-spin" />
            מסנכרן…
          </span>
        ) : showingCached ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            שמירה אחרונה
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            מעודכן
          </span>
        )}
      </div>
      <dl className="mt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">אקסל</dt>
          <dd className="font-medium tabular-nums">{excelLabel ?? "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">גוגל אדס</dt>
          <dd className={cn("font-medium tabular-nums", !googleLabel && "text-muted-foreground")}>
            {googleLabel ?? "לא מחובר"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">פייסבוק</dt>
          <dd
            className={cn(
              "font-medium tabular-nums",
              !facebookLabel && "text-muted-foreground",
            )}
          >
            {facebookLabel ?? "לא מחובר"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
