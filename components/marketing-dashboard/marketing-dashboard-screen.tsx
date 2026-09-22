"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BarChart3, ChevronDown, ChevronLeft, ChevronUp, Receipt, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { type GoogleAdsConnection } from "@/app/actions/google-ads";
import { type FacebookAdsConnection } from "@/app/actions/facebook-ads";
import { cn } from "@/lib/utils";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import {
  DATE_PRESET_LABEL,
  DATE_PRESET_ORDER,
  DEFAULT_AGENT_MULTIPLIER,
  GOOGLE_ADS_CUBE_SOURCE,
  GOOGLE_ADS_SHEMESH_CUBE_SOURCE,
  campaignPnl,
  cubeMarketingTotals,
  facebookAdsRollup,
  formatRangeDisplay,
  formatIls,
  googleAdsRollup,
  googleSpendBySource as rollupGoogleSpendBySource,
  facebookSpendBySource as rollupFacebookSpendBySource,
  inDateRange,
  isoDay,
  isGoogleAdsCube,
  rangeForPreset,
  resolveCampaignNames,
  sourceMatchesCampaignName,
  canonicalCampaignSource,
  spanOfIsoDates,
  type AgentRate,
  type CampaignExpense,
  type CampaignFlag,
  type DatePreset,
  type DateRange,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import { formatAsOfLabel, formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import type { DashboardData } from "@/lib/sales-dashboard/types";
import {
  LIVE_DASHBOARD_CACHE_KEY,
  SOURCE_PNL_SNAPSHOT_KEY,
  publishLiveDashboard,
  readCachedLiveDashboard,
} from "@/lib/sales-dashboard/client-snapshot";
import {
  wageForContractProductions,
  productionDateOf,
  type EmployeePayProfile,
} from "@/lib/employees/contract";
import { insurerIncomeForProductions } from "@/lib/finance/insurer-income";
import {
  matchesSourcePnlKind,
  type SourcePnlKind,
} from "@/lib/sales-dashboard/columns";
import {
  adsSourceBrand,
  assignOperatingBrand,
  matchesOperatingBrand,
  sourceNameVisibleInBrand,
} from "@/lib/finance/operating-brand";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import {
  CampaignDialog,
  CampaignLineDialog,
  Money,
  type CampaignLineKind,
} from "@/components/marketing-dashboard/campaign-dialog";
import { Input } from "@/components/ui/input";
import { GoogleAdsAccountPicker } from "@/components/marketing-dashboard/google-ads-panel";
import { FacebookAdsAccountPicker, FacebookAdsMapper } from "@/components/marketing-dashboard/facebook-ads-panel";

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

const CACHE_KEY = SOURCE_PNL_SNAPSHOT_KEY;
const LEGACY_CACHE_KEY = LIVE_DASHBOARD_CACHE_KEY;

type LoadPhase = "excel" | "google" | "facebook" | "idle";

type LoadStepStatus = "pending" | "active" | "done";

type CubeViewTab = "all" | "profit" | "loss" | "hidden";

const CUBE_VIEW_TABS: { id: CubeViewTab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "profit", label: "רווחים" },
  { id: "loss", label: "הפסדים" },
  { id: "hidden", label: "מוסתרים" },
];

function isHiddenSourceCube(card: { income: number; expenseTotal: number }): boolean {
  return card.income <= 0 && card.expenseTotal <= 0;
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

function normalizeGoogleCampaigns(rows: unknown[]): GoogleAdsCampaignRow[] {
  return asArray<Record<string, unknown>>(rows)
    .map((row) => {
      const googleCampaignId = String(row.googleCampaignId ?? row.google_campaign_id ?? "").trim();
      if (!googleCampaignId) return null;
      const source = row.sourceName ?? row.source_name;
      return {
        googleCampaignId,
        googleCampaignName: String(row.googleCampaignName ?? row.google_campaign_name ?? ""),
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
      const googleCampaignId = String(row.googleCampaignId ?? row.google_campaign_id ?? "").trim();
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
        facebookCampaignName: String(row.facebookCampaignName ?? row.facebook_campaign_name ?? ""),
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

function spendForSource(map: Record<string, number>, sourceName: string): number {
  return map[canonicalCampaignSource(sourceName)] ?? 0;
}

type SourcePnlSnapshot = {
  version: 1;
  savedAt: string;
  /** True only after wages + ads were loaded from DB (not excel-only cache). */
  financeReady?: boolean;
  data: DashboardData;
  flags: CampaignFlag[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles: EmployeePayProfile[];
  defaultMultiplier: number;
  insurerMultiplier?: number;
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  googleSpendBySource?: Record<string, number>;
  facebookAds: FacebookAdsConnection;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  facebookSpendBySource?: Record<string, number>;
};

function marketingLooksLive(marketing: {
  payProfiles?: EmployeePayProfile[];
  googleAds?: GoogleAdsConnection;
  facebookAds?: FacebookAdsConnection;
  googleCampaigns?: GoogleAdsCampaignRow[];
  facebookCampaigns?: FacebookAdsCampaignRow[];
  googleStats?: GoogleAdsDailyStat[];
  facebookStats?: FacebookAdsDailyStat[];
  googleSpendBySource?: Record<string, number>;
  facebookSpendBySource?: Record<string, number>;
}): boolean {
  if ((marketing.payProfiles?.length ?? 0) === 0) return false;
  const adsConnected =
    Boolean(marketing.googleAds?.connected) || Boolean(marketing.facebookAds?.connected);
  const hasMaps =
    (marketing.googleCampaigns?.length ?? 0) > 0 ||
    (marketing.facebookCampaigns?.length ?? 0) > 0;
  const hasSpend =
    Object.values(marketing.googleSpendBySource ?? {}).some((n) => n > 0) ||
    Object.values(marketing.facebookSpendBySource ?? {}).some((n) => n > 0);
  if (adsConnected && !hasMaps && !hasSpend) return false;
  const hasAdsStats =
    (marketing.googleStats?.length ?? 0) > 0 ||
    (marketing.facebookStats?.length ?? 0) > 0;
  if (adsConnected && !hasAdsStats && !hasSpend) return false;
  return true;
}

function readLegacyLiveCache(): DashboardData | null {
  try {
    const raw =
      localStorage.getItem(LEGACY_CACHE_KEY) ?? sessionStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData;
    if (parsed?.source !== "live") return null;
    if (!Array.isArray(parsed.marketing?.productions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readSourcePnlSnapshot(): SourcePnlSnapshot | null {
  if (typeof window === "undefined") return null;
  const live = readCachedLiveDashboard();
  let snapshot: SourcePnlSnapshot | null = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SourcePnlSnapshot;
      if (parsed?.version === 1 && parsed.data?.source === "live") {
        snapshot = parsed;
      }
    }
  } catch {
    /* ignore */
  }
  if (!snapshot) {
    const legacy = live ?? readLegacyLiveCache();
    if (!legacy) return null;
    snapshot = {
      version: 1,
      savedAt: legacy.syncedAt ?? "",
      financeReady: false,
      data: legacy,
      flags: [],
      expenses: [],
      rates: [],
      payProfiles: [],
      defaultMultiplier: DEFAULT_AGENT_MULTIPLIER,
      googleAds: EMPTY_GOOGLE,
      googleCampaigns: [],
      googleStats: [],
      googleSpendBySource: {},
      facebookAds: EMPTY_FACEBOOK,
      facebookCampaigns: [],
      facebookStats: [],
      facebookSpendBySource: {},
    };
  }
  if (live) {
    snapshot = {
      ...snapshot,
      savedAt: live.syncedAt ?? snapshot.savedAt,
      data: live,
    };
  }
  return snapshot;
}

function writeSourcePnlSnapshot(snapshot: SourcePnlSnapshot) {
  if (snapshot.data.source !== "live") return;
  publishLiveDashboard(snapshot.data);
  const stored: SourcePnlSnapshot = {
    ...snapshot,
    // Daily ads rows + full Excel blow localStorage quota and used to come
    // back as fake ₪0. Excel is in the live cache; stats are refetched.
    financeReady: false,
    googleStats: [],
    facebookStats: [],
    data: {
      ...snapshot.data,
      marketing: snapshot.data.marketing
        ? { ...snapshot.data.marketing, productions: [] }
        : snapshot.data.marketing,
    },
  };
  try {
    const raw = JSON.stringify(stored);
    localStorage.setItem(CACHE_KEY, raw);
    sessionStorage.setItem(CACHE_KEY, raw);
    sessionStorage.setItem(LEGACY_CACHE_KEY, JSON.stringify(snapshot.data));
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

const SOURCE_PNL_COPY: Record<
  SourcePnlKind,
  { title: string; processLabel: string; subtitleLead: string }
> = {
  volume: {
    title: "רווח והפסד לפי מקור (היקף)",
    processLabel: "מכירה",
    subtitleLead: "רק סגירות מסוג מכירה מהאקסל — עליהן מקבלים היקף.",
  },
  settled: {
    title: "רווח והפסד לפי מקור (נפרעים)",
    processLabel: "מינוי סוכן",
    subtitleLead: "רק סגירות מסוג מינוי סוכן מהאקסל — עליהן מקבלים נפרעים.",
  },
};

export function SourcePnlScreen({ kind = "volume" }: { kind?: SourcePnlKind }) {
  const { brand, shemeshEmployeeNames } = useOperatingBrand();
  const { dashboard: liveDashboard } = useLiveDashboard();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [flags, setFlags] = useState<CampaignFlag[]>([]);
  const [expenses, setExpenses] = useState<CampaignExpense[]>([]);
  const [rates, setRates] = useState<AgentRate[]>([]);
  const [payProfiles, setPayProfiles] = useState<EmployeePayProfile[]>([]);
  const [defaultMultiplier, setDefaultMultiplier] = useState(DEFAULT_AGENT_MULTIPLIER);
  const [preset, setPreset] = useState<DatePreset>("ytd");
  const [cubeView, setCubeView] = useState<CubeViewTab>("all");
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [lineDetail, setLineDetail] = useState<{
    name: string;
    kind: CampaignLineKind;
  } | null>(null);
  const [googleAds, setGoogleAds] = useState<GoogleAdsConnection>(EMPTY_GOOGLE);
  const [googleCampaigns, setGoogleCampaigns] = useState<GoogleAdsCampaignRow[]>([]);
  const [googleStats, setGoogleStats] = useState<GoogleAdsDailyStat[]>([]);
  const [googleSpendBySource, setGoogleSpendBySource] = useState<Record<string, number>>({});
  const [facebookAds, setFacebookAds] = useState<FacebookAdsConnection>(EMPTY_FACEBOOK);
  const [facebookCampaigns, setFacebookCampaigns] = useState<FacebookAdsCampaignRow[]>([]);
  const [facebookStats, setFacebookStats] = useState<FacebookAdsDailyStat[]>([]);
  const [facebookSpendBySource, setFacebookSpendBySource] = useState<Record<string, number>>({});
  const [financeReady, setFinanceReady] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [, setLoadPhase] = useState<LoadPhase>("idle");
  const [, setExcelStep] = useState<LoadStepStatus>("pending");
  const [, setGoogleStep] = useState<LoadStepStatus>("pending");
  const [, setFacebookStep] = useState<LoadStepStatus>("pending");
  const [showingSavedSnapshot, setShowingSavedSnapshot] = useState(false);
  const [quietRefreshing, setQuietRefreshing] = useState(false);
  const rangeRef = useRef(rangeForPreset("ytd", { from: null, to: null }));
  const bootDoneRef = useRef(false);
  const lastQuietRefreshAtRef = useRef(0);
  const skipRangeFetchRef = useRef(true);

  const applySnapshot = useCallback((snapshot: SourcePnlSnapshot) => {
    setData(snapshot.data);
    setLoadState("ok");
    setFlags(snapshot.flags);
    setExpenses(snapshot.expenses);
    setRates(snapshot.rates);
    if ((snapshot.payProfiles?.length ?? 0) > 0) {
      setPayProfiles(snapshot.payProfiles);
    }
    setDefaultMultiplier(snapshot.defaultMultiplier);
    if (snapshot.googleAds?.connected) setGoogleAds(snapshot.googleAds);
    if ((snapshot.googleCampaigns?.length ?? 0) > 0) {
      setGoogleCampaigns(normalizeGoogleCampaigns(snapshot.googleCampaigns));
    }
    if (snapshot.googleSpendBySource) {
      setGoogleSpendBySource(snapshot.googleSpendBySource);
    }
    if (snapshot.facebookAds?.connected) setFacebookAds(snapshot.facebookAds);
    if ((snapshot.facebookCampaigns?.length ?? 0) > 0) {
      setFacebookCampaigns(normalizeFacebookCampaigns(snapshot.facebookCampaigns));
    }
    if (snapshot.facebookSpendBySource) {
      setFacebookSpendBySource(snapshot.facebookSpendBySource);
    }
    if ((snapshot.googleStats?.length ?? 0) > 0) {
      setGoogleStats(normalizeGoogleStats(snapshot.googleStats));
    }
    if ((snapshot.facebookStats?.length ?? 0) > 0) {
      setFacebookStats(normalizeFacebookStats(snapshot.facebookStats));
    }
    // Cache may paint Excel; wages/ads stay «טוען» until this session's DB fetch.
    setFinanceReady(false);
    setShowingSavedSnapshot(true);
  }, []);

  useLayoutEffect(() => {
    const snapshot = readSourcePnlSnapshot();
    if (!snapshot) return;
    applySnapshot(snapshot);
    setLoadPhase("idle");
    setExcelStep("done");
    setGoogleStep("done");
    setFacebookStep("done");
  }, [applySnapshot]);

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

  const range = useMemo(() => rangeForPreset(preset, custom), [preset, custom]);
  rangeRef.current = range;

  const loadExcel = useCallback(
    async (options?: { force?: boolean }): Promise<DashboardData> => {
      const qs = options?.force
        ? `?force=1&t=${Date.now()}`
        : `?t=${Date.now()}`;
      const res = await fetch(`/api/sales-dashboard${qs}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(res.status === 401 ? "אין הרשאה" : "שגיאת טעינה");
      const next = (await res.json()) as DashboardData;
      if (options?.force || next.source === "live" || !readSourcePnlSnapshot()) {
        setData(next);
        setLoadState("ok");
      }
      return next;
    },
    [],
  );

  const loadStateRow = useCallback(
    async (
      statsRange?: DateRange,
      options?: { trackSteps?: boolean },
    ) => {
      const trackSteps = options?.trackSteps ?? false;
      if (trackSteps) {
        setLoadPhase("google");
        setGoogleStep("active");
        setFacebookStep("pending");
      }

      const params = new URLSearchParams({ t: String(Date.now()) });
      if (statsRange?.from) params.set("from", statsRange.from);
      if (statsRange?.to) params.set("to", statsRange.to);

      try {
        const res = await fetch(`/api/marketing-finance?${params}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(
            res.status === 401 ? "אין הרשאה" : "טעינת שכר ושיווק נכשלה",
          );
        }
        const bundle = (await res.json()) as {
          flags: CampaignFlag[];
          expenses: CampaignExpense[];
          rates: AgentRate[];
          payProfiles?: EmployeePayProfile[];
          defaultMultiplier: number;
          insurerMultiplier?: number;
          error?: string;
          googleAds: GoogleAdsConnection;
          googleCampaigns: GoogleAdsCampaignRow[];
          googleStats: GoogleAdsDailyStat[];
          googleSpendBySource?: Record<string, number>;
          facebookAds: FacebookAdsConnection;
          facebookCampaigns: FacebookAdsCampaignRow[];
          facebookStats: FacebookAdsDailyStat[];
          facebookSpendBySource?: Record<string, number>;
        };
        if (bundle.error) toast.error(bundle.error);
        const googleCampaignsNext = normalizeGoogleCampaigns(bundle.googleCampaigns);
        const googleStatsNext = normalizeGoogleStats(bundle.googleStats);
        const facebookCampaignsNext = normalizeFacebookCampaigns(bundle.facebookCampaigns);
        const facebookStatsNext = normalizeFacebookStats(bundle.facebookStats);
        const googleSpendNext = asSpendMap(bundle.googleSpendBySource);
        const facebookSpendNext = asSpendMap(bundle.facebookSpendBySource);
        setFlags(asArray<CampaignFlag>(bundle.flags));
        setExpenses(asArray<CampaignExpense>(bundle.expenses));
        setRates(asArray<AgentRate>(bundle.rates));
        setPayProfiles(asArray<EmployeePayProfile>(bundle.payProfiles));
        setDefaultMultiplier(bundle.defaultMultiplier);
        setGoogleAds(bundle.googleAds);
        setGoogleCampaigns(googleCampaignsNext);
        setGoogleStats(googleStatsNext);
        setGoogleSpendBySource(googleSpendNext);
        setFacebookAds(bundle.facebookAds);
        setFacebookCampaigns(facebookCampaignsNext);
        setFacebookStats(facebookStatsNext);
        setFacebookSpendBySource(facebookSpendNext);
        if (trackSteps) {
          setGoogleStep("done");
          setFacebookStep("done");
          setLoadPhase("idle");
        }
        return {
          flags: asArray<CampaignFlag>(bundle.flags),
          expenses: asArray<CampaignExpense>(bundle.expenses),
          rates: asArray<AgentRate>(bundle.rates),
          payProfiles: asArray<EmployeePayProfile>(bundle.payProfiles),
          defaultMultiplier: bundle.defaultMultiplier,
          googleAds: bundle.googleAds,
          googleCampaigns: googleCampaignsNext,
          googleStats: googleStatsNext,
          googleSpendBySource: googleSpendNext,
          facebookAds: bundle.facebookAds,
          facebookCampaigns: facebookCampaignsNext,
          facebookStats: facebookStatsNext,
          facebookSpendBySource: facebookSpendNext,
        };
      } catch (err) {
        setFinanceReady(false);
        if (trackSteps) {
          setGoogleStep("done");
          setFacebookStep("done");
          setLoadPhase("idle");
        }
        throw err;
      }
    },
    [],
  );

  const persistSnapshot = useCallback(
    (
      excelData: DashboardData,
      marketing: NonNullable<Awaited<ReturnType<typeof loadStateRow>>>,
    ) => {
      const snapshot: SourcePnlSnapshot = {
        version: 1,
        savedAt: excelData.syncedAt ?? new Date().toISOString(),
        financeReady: true,
        data: excelData,
        ...marketing,
      };
      const ready = marketingLooksLive(marketing);
      writeSourcePnlSnapshot({ ...snapshot, financeReady: ready });
      setFinanceReady(ready);
      setShowingSavedSnapshot(false);
    },
    [],
  );

  const refreshMarketing = useCallback(
    async (statsRange: DateRange) => {
      let marketing = await loadStateRow(statsRange, { trackSteps: false });
      if (marketing && !marketingLooksLive(marketing)) {
        await new Promise((r) => setTimeout(r, 800));
        marketing = await loadStateRow(statsRange, { trackSteps: false });
      }
      if (marketing && !marketingLooksLive(marketing)) {
        toast.error("שכר או הוצאות שיווק לא נטענו מהשרת — רעננו את הדף");
      }
      return marketing;
    },
    [loadStateRow],
  );

  // After topbar «סנכרן הכל» — refresh marketing bundles and keep local snapshot.
  useEffect(() => {
    const onGlobalSync = () => {
      void (async () => {
        try {
          setFinanceReady(false);
          const marketing = await refreshMarketing(rangeRef.current);
          const excelData = readCachedLiveDashboard();
          if (excelData && marketing) persistSnapshot(excelData, marketing);
          setShowingSavedSnapshot(false);
        } catch (err: unknown) {
          setFinanceReady(false);
          toast.error(err instanceof Error ? err.message : "רענון אחרי סנכרון נכשל");
        }
      })();
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
  }, [persistSnapshot, refreshMarketing]);

  // Paint Excel instantly, then always reload wages + ads from the database.
  useEffect(() => {
    bootDoneRef.current = true;
    void (async () => {
      const saved = readSourcePnlSnapshot();
      setQuietRefreshing(true);
      setFinanceReady(false);
      try {
        const [excelData, marketing] = await Promise.all([
          loadExcel({ force: false }),
          refreshMarketing(rangeRef.current),
        ]);
        const nextExcel =
          excelData?.source === "live"
            ? excelData
            : saved?.data?.source === "live"
              ? saved.data
              : null;
        if (nextExcel && marketing) persistSnapshot(nextExcel, marketing);
        lastQuietRefreshAtRef.current = Date.now();
      } catch (err: unknown) {
        setFinanceReady(false);
        if (!readSourcePnlSnapshot()) {
          toast.error(err instanceof Error ? err.message : "טעינת אקסל נכשלה");
        }
      } finally {
        setQuietRefreshing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Date range change → DB stats only. Skip the first run; boot already loaded.
  useEffect(() => {
    if (skipRangeFetchRef.current) {
      skipRangeFetchRef.current = false;
      return;
    }
    let cancelled = false;
    void refreshMarketing(range).catch((err: unknown) => {
      if (!cancelled) {
        toast.error(err instanceof Error ? err.message : "שגיאת טעינת שיווק");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshMarketing, range.from, range.to]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleFlag = params.get("google_ads");
    const facebookFlag = params.get("facebook_ads");
    if (!googleFlag && !facebookFlag) return;
    const googleMessages: Record<string, string> = {
      connected: `גוגל אדס חובר. ביטוחים ב«${GOOGLE_ADS_CUBE_SOURCE}», פיננסים ב«${GOOGLE_ADS_SHEMESH_CUBE_SOURCE}».`,
      pick: "בחרו חשבון גוגל אדס",
      missing_env: "חסרים פרטי חיבור גוגל אדס בשרת",
      error: "חיבור גוגל אדס נכשל",
      sync_error: "החיבור נשמר אבל הסנכרון נכשל",
      denied: "החיבור לגוגל בוטל",
      auth: "צריך להתחבר למערכת קודם",
    };
    const facebookMessages: Record<string, string> = {
      connected: "פייסבוק חובר. שייכו כל קמפיין לקוביה.",
      pick: "בחרו חשבון מודעות בפייסבוק",
      missing_env: "חסרים FACEBOOK_APP_ID / FACEBOOK_APP_SECRET בשרת",
      error: "חיבור פייסבוק נכשל",
      sync_error: "החיבור נשמר אבל הסנכרון נכשל",
      denied: "החיבור לפייסבוק בוטל",
      auth: "צריך להתחבר למערכת קודם",
    };
    if (googleFlag) {
      const ok = googleFlag === "connected" || googleFlag === "pick";
      if (ok) toast.success(googleMessages[googleFlag] ?? googleFlag);
      else toast.error(googleMessages[googleFlag] ?? googleFlag);
    }
    if (facebookFlag) {
      const ok = facebookFlag === "connected" || facebookFlag === "pick";
      if (ok) toast.success(facebookMessages[facebookFlag] ?? facebookFlag);
      else toast.error(facebookMessages[facebookFlag] ?? facebookFlag);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const productions = useMemo(() => {
    const rows = data?.marketing?.productions ?? [];
    return rows.filter((row) => {
      if (!matchesSourcePnlKind(row.process, kind)) return false;
      return matchesOperatingBrand(
        assignOperatingBrand({
          agent: row.agent,
          source: row.source,
          shemeshEmployeeNames,
        }),
        brand,
      );
    });
  }, [data?.marketing?.productions, kind, brand, shemeshEmployeeNames]);
  const wageContextRows = useMemo(() => {
    const rows = data?.marketing?.productions ?? [];
    return rows.filter((row) => {
      if (!inDateRange(productionDateOf(row), range)) return false;
      return matchesOperatingBrand(
        assignOperatingBrand({
          agent: row.agent,
          source: row.source,
          shemeshEmployeeNames,
        }),
        brand,
      );
    });
  }, [data?.marketing?.productions, range, brand, shemeshEmployeeNames]);
  const sourceNames = useMemo(() => {
    const names = new Set<string>();
    const productionNames = new Set<string>();
    for (const row of productions) {
      const name = canonicalCampaignSource(row.source);
      if (name) {
        names.add(name);
        productionNames.add(name);
      }
    }
    const consider = (raw: string) => {
      const canon = canonicalCampaignSource(raw);
      if (!canon) return;
      if (
        sourceNameVisibleInBrand(canon, brand, productionNames.has(canon))
      ) {
        names.add(canon);
      }
    };
    for (const row of data?.marketing?.sources ?? []) consider(row.name);
    for (const name of data?.marketing?.sourceCatalog ?? []) consider(name);
    if (kind === "volume") {
      if (brand === "all" || brand === "liba") names.add(GOOGLE_ADS_CUBE_SOURCE);
      if (brand === "all" || brand === "shemesh") {
        names.add(GOOGLE_ADS_SHEMESH_CUBE_SOURCE);
      }
      for (const row of facebookCampaigns) consider(row.sourceName ?? "");
    }
    return Array.from(names);
  }, [
    productions,
    data?.marketing?.sources,
    data?.marketing?.sourceCatalog,
    facebookCampaigns,
    kind,
    brand,
  ]);
  const campaignNames = useMemo(
    () => resolveCampaignNames(sourceNames, flags),
    [sourceNames, flags],
  );
  const dataSpan = useMemo(
    () =>
      spanOfIsoDates([
        ...productions.map((row) => productionDateOf(row)),
        ...(kind === "volume" ? expenses.map((row) => row.occurredAt) : []),
        ...(kind === "volume" ? googleStats.map((row) => row.day) : []),
        ...(kind === "volume" ? facebookStats.map((row) => row.day) : []),
      ]),
    [productions, expenses, googleStats, facebookStats, kind],
  );

  const unmappedFacebookCount = useMemo(
    () =>
      facebookCampaigns.filter((row) => row.enabled && !row.sourceName?.trim()).length,
    [facebookCampaigns],
  );
  const facebookSpendInRange = useMemo(
    () =>
      facebookStats.reduce(
        (sum, row) => sum + (inDateRange(row.day, range) ? row.cost : 0),
        0,
      ),
    [facebookStats, range],
  );
  const googleSpendInRange = useMemo(
    () =>
      googleStats.reduce(
        (sum, row) => sum + (inDateRange(row.day, range) ? row.cost : 0),
        0,
      ),
    [googleStats, range],
  );
  const googleSpendResolved = useMemo(() => {
    const computed = rollupGoogleSpendBySource(googleCampaigns, googleStats, range);
    return Object.keys(computed).length > 0 ? computed : googleSpendBySource;
  }, [googleCampaigns, googleStats, range, googleSpendBySource]);
  const facebookSpendResolved = useMemo(() => {
    const computed = rollupFacebookSpendBySource(facebookCampaigns, facebookStats, range);
    return Object.keys(computed).length > 0 ? computed : facebookSpendBySource;
  }, [facebookCampaigns, facebookStats, range, facebookSpendBySource]);

  const allCards = useMemo(
    () =>
      campaignNames
        .map((name) => {
          const rows = productions.filter(
            (row) =>
              sourceMatchesCampaignName(row.source, name) &&
              inDateRange(productionDateOf(row), range),
          );
          const includeManualAds =
            kind === "volume" &&
            matchesOperatingBrand(adsSourceBrand(name), brand);
          const includeGoogleAds =
            kind === "volume" &&
            (isGoogleAdsCube(name) || includeManualAds);
          const costs = includeManualAds
            ? expenses.filter(
                (row) =>
                  sourceMatchesCampaignName(row.sourceName, name) &&
                  inDateRange(row.occurredAt, range),
              )
            : [];
          const active = rows.filter((row) => row.status === "active");
          const premium = active.reduce((sum, row) => sum + row.premium, 0);
          const google = includeGoogleAds
            ? googleAdsRollup(name, googleCampaigns, googleStats, range)
            : { cost: 0, clicks: 0, impressions: 0, campaigns: [] };
          const facebook = includeManualAds
            ? facebookAdsRollup(name, facebookCampaigns, facebookStats, range)
            : { cost: 0, clicks: 0, impressions: 0, campaigns: [] };
          const googleCost = includeGoogleAds
            ? spendForSource(googleSpendResolved, name) || google.cost
            : 0;
          const facebookCost = includeManualAds
            ? spendForSource(facebookSpendResolved, name) || facebook.cost
            : 0;
          const marketing = cubeMarketingTotals(
            name,
            costs,
            googleCost,
            google.campaigns.length || (googleCost > 0 ? 1 : 0),
            facebookCost,
            facebook.campaigns.length || (facebookCost > 0 ? 1 : 0),
          );
          const adsTotal = includeGoogleAds || includeManualAds ? marketing.adsTotal : 0;
          const wageTotal = wageForContractProductions(active, {
            profiles: payProfiles,
            rates,
            fallback: 0,
            kind,
            contextRows: wageContextRows,
          });
          const insurer = insurerIncomeForProductions(active, {
            yearContext: data?.marketing?.productions ?? productions,
          });
          const pnl = campaignPnl({
            premium,
            wageTotal,
            adsTotal,
            income: insurer.income,
          });
          const workers = new Set(
            active.map((row) => row.agent).filter((agent) => agent && agent !== "—"),
          );
          return {
            name,
            rows,
            costs,
            activeCount: active.length,
            premium,
            adsTotal,
            wageTotal,
            income: pnl.income,
            expenseTotal: pnl.expenseTotal,
            net: pnl.net,
            workers: workers.size,
            status: pnl.status,
          };
        })
        .sort(
          (a, b) =>
            b.net - a.net || b.premium - a.premium || a.name.localeCompare(b.name, "he"),
        ),
    [
      campaignNames,
      productions,
      expenses,
      range,
      googleCampaigns,
      googleStats,
      googleSpendResolved,
      facebookCampaigns,
      facebookStats,
      facebookSpendResolved,
      rates,
      payProfiles,
      wageContextRows,
      defaultMultiplier,
      kind,
      brand,
      data,
    ],
  );

  const cubeBuckets = useMemo(() => {
    const hidden: typeof allCards = [];
    const profit: typeof allCards = [];
    const loss: typeof allCards = [];
    for (const card of allCards) {
      if (isHiddenSourceCube(card)) hidden.push(card);
      else if (card.net < 0) loss.push(card);
      else profit.push(card);
    }
    hidden.sort((a, b) => a.name.localeCompare(b.name, "he"));
    return { hidden, profit, loss };
  }, [allCards]);

  const visibleCards = useMemo(() => {
    if (cubeView === "hidden") return cubeBuckets.hidden;
    if (cubeView === "profit") return cubeBuckets.profit;
    if (cubeView === "loss") return cubeBuckets.loss;
    return [...cubeBuckets.profit, ...cubeBuckets.loss].sort(
      (a, b) => b.net - a.net || b.premium - a.premium || a.name.localeCompare(b.name, "he"),
    );
  }, [cubeView, cubeBuckets]);

  const cubeViewCounts = {
    all: cubeBuckets.profit.length + cubeBuckets.loss.length,
    profit: cubeBuckets.profit.length,
    loss: cubeBuckets.loss.length,
    hidden: cubeBuckets.hidden.length,
  };

  const totals = useMemo(
    () =>
      allCards.reduce(
        (acc, card) => ({
          premium: acc.premium + card.premium,
          income: acc.income + card.income,
          wageTotal: acc.wageTotal + card.wageTotal,
          adsTotal: acc.adsTotal + card.adsTotal,
          net: acc.net + card.net,
          closures: acc.closures + card.activeCount,
        }),
        { premium: 0, income: 0, wageTotal: 0, adsTotal: 0, net: 0, closures: 0 },
      ),
    [allCards],
  );

  const highlightSources = useMemo(() => {
    const active = [...cubeBuckets.profit, ...cubeBuckets.loss];
    const leader = [...active].sort(
      (a, b) => b.net - a.net || b.premium - a.premium || a.name.localeCompare(b.name, "he"),
    )[0] ?? null;
    const loser =
      [...cubeBuckets.loss].sort(
        (a, b) => a.net - b.net || b.adsTotal - a.adsTotal || a.name.localeCompare(b.name, "he"),
      )[0] ?? null;
    return { leader, loser };
  }, [cubeBuckets]);

  const selectedExcelRows = useMemo(() => {
    if (!selected) return [];
    return productions.filter((row) => sourceMatchesCampaignName(row.source, selected));
  }, [productions, selected]);
  const selectedCard = allCards.find((card) => card.name === selected) ?? null;
  const lineCard = allCards.find((card) => card.name === lineDetail?.name) ?? null;
  const asOf = data ? formatAsOfLabel(data.syncedAt) : "";
  const rangeLabel = formatRangeDisplay(preset, range, dataSpan);
  const copy = SOURCE_PNL_COPY[kind];
  const TitleIcon = kind === "settled" ? Receipt : BarChart3;

  return (
    <section className="mx-auto w-full max-w-[72rem] space-y-3.5 sm:space-y-6">
      <header className="dash-enter px-0.5 sm:px-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
          חשבונות ליבה · {copy.processLabel}
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-highlight/35 sm:size-10">
                <TitleIcon className="size-4 sm:size-5" />
              </span>
              <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight sm:text-3xl sm:leading-none">
                {kind === "volume" ? "רווח והפסד לפי מקור" : copy.title}
              </h1>
            </div>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
              {copy.subtitleLead} פרמיה, הכנסה לפי חוזה, שכר ושיווק לפי מותג.
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground sm:hidden">
              פרמיה · הכנסה לפי חוזה · שכר · שיווק לפי מותג
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
                ? formatLastUpdatedAt(facebookAds.lastSyncedAt) ?? "מחובר · טרם סונכרן"
                : null
            }
            liveUpdating={quietRefreshing}
            showingCached={showingSavedSnapshot && !quietRefreshing}
          />
        </div>
        {googleAds.lastError ? (
          <p className="mt-2 text-xs text-red-700">{googleAds.lastError}</p>
        ) : null}
        {facebookAds.lastError ? (
          <p className="mt-2 text-xs text-red-700">{facebookAds.lastError}</p>
        ) : null}
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
          <span dir="ltr" className="text-[12px] font-medium tabular-nums text-muted-foreground sm:text-sm">
            {rangeLabel}
          </span>
        </div>
        {preset === "custom" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Input
              type="date"
              className="h-11 w-full rounded-xl border-black/[0.06] sm:h-10 sm:w-40"
              value={custom.from ?? ""}
              onChange={(e) => setCustom((prev) => ({ ...prev, from: e.target.value || null }))}
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">עד</span>
            <Input
              type="date"
              className="h-11 w-full rounded-xl border-black/[0.06] sm:h-10 sm:w-40"
              value={custom.to ?? ""}
              onChange={(e) => setCustom((prev) => ({ ...prev, to: e.target.value || null }))}
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
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
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
          ) : googleAds.oauthReady && googleAds.developerTokenReady ? (
            <a
              href="/api/google-ads/connect"
              className="inline-flex shrink-0 items-center rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white active:scale-95"
            >
              חבר גוגל אדס
            </a>
          ) : null}
          {facebookAds.connected ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
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
          ) : facebookAds.oauthReady ? (
            <a
              href="/api/facebook-ads/connect"
              className="inline-flex shrink-0 items-center rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white active:scale-95"
            >
              חבר פייסבוק
            </a>
          ) : null}
        </div>

        {googleAds.needsCustomerPick ? (
          <div className="mt-4">
            <GoogleAdsAccountPicker onChanged={() => void loadStateRow(range)} />
          </div>
        ) : null}
        {facebookAds.needsAccountPick ? (
          <div className="mt-4">
            <FacebookAdsAccountPicker onChanged={() => void loadStateRow(range)} />
          </div>
        ) : null}
      </div>

      {allCards.length > 0 ? (
        <div
          className="dash-enter grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6"
          style={{ animationDelay: "80ms" }}
        >
          <SummaryStat label="סגירות" value={totals.closures.toLocaleString("he-IL")} />
          <SummaryStat label="פרמיה" value={formatIls(totals.premium)} />
          <SummaryStat label="הכנסה מחברות" value={formatIls(totals.income)} />
          <SummaryStat
            label="שכר"
            value={financeReady ? formatIls(totals.wageTotal) : "טוען…"}
          />
          <SummaryStat
            label="שיווק"
            value={financeReady ? formatIls(totals.adsTotal) : "טוען…"}
          />
          <SummaryStat
            label="רווח / הפסד"
            value={financeReady ? formatIls(totals.net) : "טוען…"}
            emphasize={
              financeReady ? (totals.net >= 0 ? "profit" : "loss") : undefined
            }
          />
        </div>
      ) : null}

      {allCards.length > 0 && (highlightSources.leader || highlightSources.loser) ? (
        <div
          className="dash-enter grid gap-3 sm:grid-cols-2 sm:gap-4"
          style={{ animationDelay: "100ms" }}
        >
          {highlightSources.leader ? (
            <HighlightSourceCard
              kind="leader"
              name={highlightSources.leader.name}
              net={highlightSources.leader.net}
              closures={highlightSources.leader.activeCount}
              premium={highlightSources.leader.premium}
              financeReady={financeReady}
              onOpen={() => setSelected(highlightSources.leader!.name)}
            />
          ) : null}
          {highlightSources.loser ? (
            <HighlightSourceCard
              kind="loser"
              name={highlightSources.loser.name}
              net={highlightSources.loser.net}
              closures={highlightSources.loser.activeCount}
              premium={highlightSources.loser.premium}
              financeReady={financeReady}
              onOpen={() => setSelected(highlightSources.loser!.name)}
            />
          ) : (
            <div className="relative overflow-hidden rounded-[1.25rem] border border-dashed border-black/[0.08] bg-white/70 px-4 py-4 sm:rounded-[var(--radius)] sm:px-5">
              <p className="text-[11px] font-medium text-muted-foreground">מקור מופסד</p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                אין מקורות בהפסד בטווח
              </p>
            </div>
          )}
        </div>
      ) : null}

      {!financeReady && data?.source === "live" ? (
        <div className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:rounded-[var(--radius)]">
          טוענים הסכמי שכר והוצאות שיווק. סגירות מהאקסל כבר מוצגות — אל תסתמכו על
          ₪0 בשכר/שיווק עד שמופיע האימות.
        </div>
      ) : null}

      {financeReady ? (
        <div className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          <button
            type="button"
            onClick={() => setVerificationOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors hover:bg-[#fffcf0] active:scale-[0.995] sm:px-5"
            aria-expanded={verificationOpen}
          >
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                אימות מקורות נתונים
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                שכר {payProfiles.length} · גוגל {googleCampaigns.length}/{googleStats.length}
                {googleSpendInRange > 0 ? ` · ${formatIls(googleSpendInRange)}` : ""}
                {" · "}פייסבוק {facebookCampaigns.length}/{facebookStats.length}
                {facebookSpendInRange > 0 ? ` · ${formatIls(facebookSpendInRange)}` : ""}
              </p>
            </div>
            {verificationOpen ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {verificationOpen ? (
            <div className="space-y-1.5 border-t border-black/[0.06] px-4 py-3.5 text-xs leading-relaxed text-muted-foreground sm:px-5">
              <ul className="space-y-1.5">
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-highlight" />
                  <span>
                    שכר: {payProfiles.length} הסכמים פעילים · עמלת סגירות בקוביה
                    (שכר חודשי גלובלי לא נכנס כאן)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-highlight" />
                  <span>
                    גוגל אדס:{" "}
                    {googleAds.connected
                      ? `מחובר · ${formatLastUpdatedAt(googleAds.lastSyncedAt) ?? "—"} · ${formatIls(googleSpendInRange)} · ביטוחים «${GOOGLE_ADS_CUBE_SOURCE}» · פיננסים «${GOOGLE_ADS_SHEMESH_CUBE_SOURCE}»`
                      : "לא מחובר"}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-highlight" />
                  <span>
                    פייסבוק:{" "}
                    {facebookAds.connected
                      ? `מחובר · ${formatLastUpdatedAt(facebookAds.lastSyncedAt) ?? "—"} · ${facebookCampaigns.length} קמפיינים · ${formatIls(facebookSpendInRange)}`
                      : "לא מחובר"}
                    {unmappedFacebookCount > 0
                      ? ` · ${unmappedFacebookCount} בלי שיוך`
                      : null}
                  </span>
                </li>
              </ul>
              {unmappedFacebookCount > 0 ? (
                <p className="mt-2.5 font-medium text-amber-800">
                  שייכו קמפיינים בפייסבוק למקור תחת «חיבור שיווק ושיוך פייסבוק».
                </p>
              ) : null}
              {facebookAds.connected &&
              facebookSpendInRange <= 0 &&
              facebookCampaigns.length > 0 ? (
                <p className="mt-2.5 font-medium text-amber-800">
                  אין הוצאות פייסבוק בטווח — בדקו טווח או סנכרנו שוב.
                </p>
              ) : null}
              {googleAds.connected && googleSpendInRange <= 0 ? (
                <p className="mt-2.5 font-medium text-amber-800">
                  אין הוצאות גוגל בטווח — בדקו טווח או סנכרנו שוב.
                </p>
              ) : null}
            </div>
          ) : null}
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
                  selectedTab && tab.id === "profit" && "bg-emerald-700 text-white",
                  selectedTab && tab.id === "loss" && "bg-red-700 text-white",
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

      {preset !== "all" && allCards.length > 0 && allCards.every((card) => card.activeCount === 0) ? (
        <div className="rounded-[1.25rem] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:rounded-[var(--radius)]">
          בטווח «{DATE_PRESET_LABEL[preset]}» אין הפקות מסוג {copy.processLabel}. לחצו
          «הכל» כדי לראות את כל מקורות הפנייה.
        </div>
      ) : null}

      {allCards.length === 0 ? (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          {!data && quietRefreshing
            ? "טוען נתונים — אין עדיין נתונים שמורים להצגה…"
            : loadState === "error" && !data
              ? "לא ניתן לטעון את דוח המנהלים."
              : data
                ? "אין מקורות פנייה מסוג " + copy.processLabel + " בדוח המנהלים לטווח הזה."
                : "אין מקורות פנייה מסוג " + copy.processLabel + " בדוח המנהלים."}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="px-0.5 text-[11px] text-muted-foreground sm:text-xs">
            {cubeView === "all"
              ? `${visibleCards.length} מקורות פעילים · ${cubeViewCounts.hidden} מוסתרים בלי הכנסה ובלי הוצאה`
              : cubeView === "hidden"
                ? `${visibleCards.length} מקורות בלי הכנסה ובלי הוצאה בטווח`
                : cubeView === "profit"
                  ? `${visibleCards.length} מקורות ברווח`
                  : `${visibleCards.length} מקורות בהפסד`}
          </p>
          {visibleCards.length === 0 ? (
            <div className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
              אין מקורות בתצוגה הזו.
            </div>
          ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => {
            const accent =
              card.status === "profit"
                ? "bg-emerald-500"
                : card.status === "loss"
                  ? "bg-red-500"
                  : "bg-highlight";
            return (
            <div
              key={card.name}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(card.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(card.name);
                }
              }}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-4 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-[transform,background-color,border-color] active:scale-[0.985] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:p-5"
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
                      {card.activeCount} סגירות · {card.workers} עובדים
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusChip status={card.status} />
                    <ChevronLeft className="size-4 text-black/25 transition-transform group-hover:-translate-x-0.5" />
                  </div>
                </div>

                <div className="mt-4 space-y-0.5 text-[13px]">
                  <CubeLine
                    label="פרמיה שנסגרה"
                    value={<Money value={card.premium} className="font-medium tabular-nums" />}
                    onOpen={() => setLineDetail({ name: card.name, kind: "premium" })}
                  />
                  <CubeLine
                    label="הכנסה מחברות"
                    value={<Money value={card.income} className="font-medium tabular-nums" />}
                    onOpen={() => setLineDetail({ name: card.name, kind: "income" })}
                  />
                  <CubeLine
                    label="שכר עובדים"
                    value={
                      financeReady ? (
                        <Money value={card.wageTotal} minus className="font-medium tabular-nums" />
                      ) : (
                        <span className="font-medium text-muted-foreground">טוען…</span>
                      )
                    }
                    onOpen={() => setLineDetail({ name: card.name, kind: "wage" })}
                  />
                  <CubeLine
                    label="שיווק והוצאות"
                    value={
                      financeReady ? (
                        <Money value={card.adsTotal} minus className="font-medium tabular-nums" />
                      ) : (
                        <span className="font-medium text-muted-foreground">טוען…</span>
                      )
                    }
                    onOpen={() => setLineDetail({ name: card.name, kind: "marketing" })}
                  />
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setLineDetail({ name: card.name, kind: "net" });
                  }}
                  className="mt-auto flex min-h-12 w-full items-end justify-between gap-3 border-t border-black/[0.06] pt-3 text-start active:opacity-80"
                  aria-label="פירוט רווח והפסד"
                >
                  <p className="text-[11px] font-medium text-muted-foreground">
                    רווח / הפסד
                  </p>
                  <p
                    className={cn(
                      "text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-2xl",
                      financeReady && card.net > 0 && "text-emerald-700",
                      financeReady && card.net < 0 && "text-red-700",
                      !financeReady && "text-muted-foreground",
                    )}
                  >
                    {financeReady ? <Money value={card.net} signed /> : "טוען…"}
                  </p>
                </button>
            </div>
            );
          })}
          </div>
          )}
        </div>
      )}

      {kind === "volume" ? (
      <div className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
        <button
          type="button"
          onClick={() => setMarketingOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors hover:bg-[#fffcf0] active:scale-[0.995] sm:px-5"
        >
          <div>
            <p className="text-sm font-semibold tracking-tight">חיבור שיווק ושיוך פייסבוק</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              גוגל אדס, פייסבוק ושיוך קמפיינים למקורות
            </p>
          </div>
          {marketingOpen ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        {marketingOpen ? (
          <div className="space-y-4 border-t border-black/[0.06] p-4 sm:p-5">
            <FacebookAdsMapper
              cubeNames={campaignNames}
              range={range}
              connection={facebookAds}
              campaigns={facebookCampaigns}
              stats={facebookStats}
              onChanged={() => void loadStateRow(range)}
            />
          </div>
        ) : null}
      </div>
      ) : null}

      <CampaignDialog
        open={Boolean(selectedCard)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        name={selectedCard?.name ?? ""}
        asOf={asOf}
        rangeLabel={rangeLabel}
        range={range}
        productions={selectedCard?.rows ?? []}
        excelRows={selectedExcelRows}
        excelHeaders={data?.marketing?.excelHeaders ?? []}
        expenses={selectedCard?.costs ?? []}
        rates={rates}
        payProfiles={payProfiles}
        wageKind={kind}
        wageContextRows={wageContextRows}
        defaultMultiplier={defaultMultiplier}
        insurerYearContext={data?.marketing?.productions ?? []}
        googleAds={googleAds}
        googleCampaigns={googleCampaigns}
        googleStats={googleStats}
        facebookCampaigns={facebookCampaigns}
        facebookStats={facebookStats}
        onChanged={() => {
          void loadStateRow(range);
        }}
      />
      <CampaignLineDialog
        open={Boolean(lineCard && lineDetail)}
        onOpenChange={(open) => {
          if (!open) setLineDetail(null);
        }}
        kind={lineDetail?.kind ?? "net"}
        name={lineCard?.name ?? ""}
        rangeLabel={rangeLabel}
        range={range}
        productions={lineCard?.rows ?? []}
        expenses={lineCard?.costs ?? []}
        rates={rates}
        payProfiles={payProfiles}
        wageKind={kind}
        wageContextRows={wageContextRows}
        defaultMultiplier={defaultMultiplier}
        insurerYearContext={data?.marketing?.productions ?? []}
        googleAds={googleAds}
        googleCampaigns={googleCampaigns}
        googleStats={googleStats}
        facebookCampaigns={facebookCampaigns}
        facebookStats={facebookStats}
        onChanged={() => {
          void loadStateRow(range);
        }}
      />
    </section>
  );
}

function StatusChip({
  status,
}: {
  status: "profit" | "loss" | "no-cost";
}) {
  const map = {
    profit: { label: "רווח", className: "bg-emerald-600 text-white" },
    loss: { label: "הפסד", className: "bg-red-600 text-white" },
    "no-cost": { label: "אין סגירות", className: "bg-zinc-100 text-zinc-700" },
  } as const;
  const item = map[status];
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", item.className)}>
      {item.label}
    </span>
  );
}

function CubeLine({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="-mx-1.5 flex min-h-11 w-[calc(100%+0.75rem)] items-center justify-between gap-3 rounded-xl px-1.5 py-2 text-start transition-colors hover:bg-black/[0.03] active:scale-[0.99] sm:min-h-0 sm:items-baseline sm:py-1.5"
      aria-label={`פירוט ${label}`}
    >
      <span className="max-w-[55%] shrink text-[12px] leading-snug text-muted-foreground sm:max-w-none sm:shrink-0 sm:text-[13px]">
        {label}
      </span>
      <span className="min-w-0 truncate text-end text-[13px]">{value}</span>
    </button>
  );
}

export const MarketingDashboardScreen = SourcePnlScreen;

function LastSyncPanel({
  excelLabel,
  googleLabel,
  facebookLabel,
  liveUpdating,
  showingCached,
  syncingExcel,
  syncingGoogle,
  syncingFacebook,
}: {
  excelLabel: string | null;
  googleLabel: string | null;
  facebookLabel: string | null;
  liveUpdating: boolean;
  showingCached: boolean;
  syncingExcel?: boolean;
  syncingGoogle?: boolean;
  syncingFacebook?: boolean;
}) {
  return (
    <div className="w-full rounded-[1.25rem] border border-black/[0.06] bg-white px-3 py-2.5 text-xs shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:min-w-[18rem] sm:rounded-[var(--radius)] sm:px-3.5 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-foreground">עדכון אחרון</p>
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
        <LastSyncRow
          label="אקסל"
          value={syncingExcel ? "מסנכרן…" : excelLabel}
        />
        <LastSyncRow
          label="גוגל אדס"
          value={
            syncingGoogle
              ? "מסנכרן…"
              : (googleLabel ?? "לא מחובר")
          }
          muted={!googleLabel && !syncingGoogle}
        />
        <LastSyncRow
          label="פייסבוק"
          value={
            syncingFacebook
              ? "מסנכרן…"
              : (facebookLabel ?? "לא מחובר")
          }
          muted={!facebookLabel && !syncingFacebook}
        />
      </dl>
    </div>
  );
}

function LastSyncRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string | null;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 font-medium text-muted-foreground">{label}</dt>
      <dd
        dir="ltr"
        className={cn(
          "text-end tabular-nums leading-snug",
          muted ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function HighlightSourceCard({
  kind,
  name,
  net,
  closures,
  premium,
  financeReady,
  onOpen,
}: {
  kind: "leader" | "loser";
  name: string;
  net: number;
  closures: number;
  premium: number;
  financeReady: boolean;
  onOpen: () => void;
}) {
  const isLeader = kind === "leader";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-4 py-4 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-[transform,background-color,border-color] active:scale-[0.985] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:px-5"
    >
      <span
        className={cn(
          "absolute inset-y-0 start-0 w-1 origin-top scale-y-100 transition-transform duration-300 group-hover:scale-y-110",
          isLeader ? "bg-emerald-500" : "bg-red-500",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {isLeader ? "מקור מוביל" : "מקור מופסד"}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight sm:text-lg">
            {name}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isLeader ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
          )}
        >
          {isLeader ? "מוביל" : "הפסד"}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-2xl",
          financeReady && isLeader && "text-emerald-700",
          financeReady && !isLeader && "text-red-700",
          !financeReady && "text-muted-foreground",
        )}
      >
        {financeReady ? <Money value={net} signed /> : "טוען…"}
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
        {closures} סגירות · פרמיה {formatIls(premium)}
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-black/35">
        פתיחה
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
      </p>
    </button>
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

