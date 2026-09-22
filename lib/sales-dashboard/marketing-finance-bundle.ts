import { createAdminClient } from "@/lib/supabase/admin";
import type { GoogleAdsConnection } from "@/app/actions/google-ads";
import type { FacebookAdsConnection } from "@/app/actions/facebook-ads";
import {
  DEFAULT_PROFIT_THRESHOLD,
  facebookSpendBySource,
  googleSpendBySource,
  type AgentRate,
  type CampaignExpense,
  type CampaignFlag,
  type DateRange,
  type ExpenseChannel,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import {
  currentAgreement,
  parseEmploymentKind,
  parsePayAgreements,
  parsePayContract,
  toPayProfile,
  withResolvedOneTimePayments,
  type EmployeePayProfile,
} from "@/lib/employees/contract";
import { countVacationDays, parseAttendanceDays } from "@/lib/employees/hours";
import {
  envCustomerId,
  envLoginCustomerId,
  envRefreshToken,
  googleAdsDeveloperToken,
  googleAdsOAuthConfigured,
} from "@/lib/google-ads/config";
import {
  envFacebookAccessToken,
  envFacebookAdAccountId,
  facebookAdsOAuthConfigured,
} from "@/lib/facebook-ads/config";

const CHANNELS = new Set<ExpenseChannel>(["google", "facebook", "manual"]);
const STATS_PAGE_SIZE = 1000;

function isChannel(value: string): value is ExpenseChannel {
  return CHANNELS.has(value as ExpenseChannel);
}

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(
    message &&
      (/relation .+ does not exist/i.test(message) ||
        /could not find the table/i.test(message) ||
        /schema cache/i.test(message)),
  );
}

function applyDayRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  range?: DateRange,
): T {
  if (range?.from) query = query.gte("day", range.from);
  if (range?.to) query = query.lte("day", range.to);
  return query;
}

export type MarketingBaseState = {
  threshold: number;
  defaultMultiplier: number;
  flags: CampaignFlag[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles: EmployeePayProfile[];
  employeesLoaded: boolean;
  error?: string;
};

export type MarketingCampaignsState = MarketingBaseState & {
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  googleSpendBySource: Record<string, number>;
  facebookAds: FacebookAdsConnection;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  facebookSpendBySource: Record<string, number>;
};

const emptyGoogleConnection = (): GoogleAdsConnection => ({
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

const emptyFacebookConnection = (): FacebookAdsConnection => ({
  oauthReady: facebookAdsOAuthConfigured(),
  connected: false,
  adAccountId: null,
  adAccountName: null,
  connectedName: null,
  lastSyncedAt: null,
  lastError: null,
  needsAccountPick: false,
});

async function fetchDailyStats(
  admin: ReturnType<typeof createAdminClient>,
  table: "google_ads_daily_stats" | "facebook_ads_daily_stats",
  idColumn: "google_campaign_id" | "facebook_campaign_id",
  range?: DateRange,
): Promise<{ id: string; day: string; cost: number; clicks: number; impressions: number; leads: number }[]> {
  const out: { id: string; day: string; cost: number; clicks: number; impressions: number; leads: number }[] = [];
  let select = `${idColumn}, day, cost, clicks, impressions, leads`;
  for (let from = 0; ; from += STATS_PAGE_SIZE) {
    let query = admin
      .from(table)
      .select(select)
      .order("day", { ascending: true })
      .order(idColumn, { ascending: true })
      .range(from, from + STATS_PAGE_SIZE - 1);
    query = applyDayRange(query, range);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelation(error.message)) return [];
      if (select.includes("leads") && /leads/i.test(error.message)) {
        select = `${idColumn}, day, cost, clicks, impressions`;
        from = -STATS_PAGE_SIZE;
        out.length = 0;
        continue;
      }
      throw new Error(error.message);
    }
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) {
      out.push({
        id: String(row[idColumn] ?? ""),
        day: String(row.day).slice(0, 10),
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        leads: Number(row.leads) || 0,
      });
    }
    if (rows.length < STATS_PAGE_SIZE) break;
  }
  return out;
}

async function loadGoogleAds(admin: ReturnType<typeof createAdminClient>, range?: DateRange) {
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
    fetchDailyStats(admin, "google_ads_daily_stats", "google_campaign_id", range),
  ]);

  if (isMissingRelation(settings.error?.message) || isMissingRelation(maps.error?.message)) {
    return { connection: emptyGoogleConnection(), campaigns: [] as GoogleAdsCampaignRow[], stats: [] as GoogleAdsDailyStat[] };
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

  const campaigns: GoogleAdsCampaignRow[] = (maps.data ?? []).map((item) => ({
    googleCampaignId: String(item.google_campaign_id),
    googleCampaignName: item.google_campaign_name,
    status: item.status,
    sourceName: item.source_name,
    enabled: item.enabled !== false,
  }));
  const stats: GoogleAdsDailyStat[] = statsRows.map((item) => ({
    googleCampaignId: item.id,
    day: item.day,
    cost: item.cost,
    clicks: item.clicks,
    impressions: item.impressions,
    leads: item.leads,
  }));

  return {
    connection: {
      oauthReady: googleAdsOAuthConfigured(),
      developerTokenReady: Boolean(googleAdsDeveloperToken()),
      connected: Boolean(envToken || dbToken),
      customerId,
      loginCustomerId,
      connectedEmail: row?.connected_email ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
      lastError: row?.last_error ?? null,
      needsCustomerPick: Boolean(envToken || dbToken) && !customerId,
    } satisfies GoogleAdsConnection,
    campaigns,
    stats,
  };
}

async function loadFacebookAds(admin: ReturnType<typeof createAdminClient>, range?: DateRange) {
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
    fetchDailyStats(admin, "facebook_ads_daily_stats", "facebook_campaign_id", range),
  ]);

  if (isMissingRelation(settings.error?.message) || isMissingRelation(maps.error?.message)) {
    return {
      connection: emptyFacebookConnection(),
      campaigns: [] as FacebookAdsCampaignRow[],
      stats: [] as FacebookAdsDailyStat[],
    };
  }
  if (maps.error) throw new Error(maps.error.message);
  if (settings.error && !isMissingRelation(settings.error.message)) {
    throw new Error(settings.error.message);
  }

  const row = settings.data;
  const envToken = envFacebookAccessToken();
  const dbToken = Boolean(row?.access_token_encrypted);
  const adAccountId = envFacebookAdAccountId() || row?.ad_account_id || null;

  const campaigns: FacebookAdsCampaignRow[] = (maps.data ?? []).map((item) => ({
    facebookCampaignId: String(item.facebook_campaign_id),
    facebookCampaignName: item.facebook_campaign_name,
    status: item.status,
    sourceName: item.source_name,
    enabled: item.enabled !== false,
  }));
  const stats: FacebookAdsDailyStat[] = statsRows.map((item) => ({
    facebookCampaignId: item.id,
    day: item.day,
    cost: item.cost,
    clicks: item.clicks,
    impressions: item.impressions,
    leads: item.leads,
  }));

  return {
    connection: {
      oauthReady: facebookAdsOAuthConfigured() || Boolean(envToken),
      connected: Boolean(envToken || dbToken),
      adAccountId,
      adAccountName: row?.ad_account_name ?? null,
      connectedName: row?.connected_name ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
      lastError: row?.last_error ?? null,
      needsAccountPick: false,
    } satisfies FacebookAdsConnection,
    campaigns,
    stats,
  };
}

async function loadSourceFinanceExpenses(
  admin: ReturnType<typeof createAdminClient>,
  range?: DateRange,
): Promise<CampaignExpense[]> {
  const { data: costs, error: costError } = await admin
    .from("finance_fixed_costs")
    .select("id, title, vendor_name")
    .eq("is_active", true)
    .eq("allocation_type", "sources");

  if (costError || !costs?.length) return [];

  const ids = costs.map((row) => row.id as string);
  let paymentsQuery = admin
    .from("finance_entries")
    .select("id, fixed_cost_id, amount, occurred_at")
    .in("fixed_cost_id", ids)
    .eq("kind", "expense");
  if (range?.from) paymentsQuery = paymentsQuery.gte("occurred_at", range.from);
  if (range?.to) paymentsQuery = paymentsQuery.lte("occurred_at", range.to);

  const [{ data: allocs }, { data: payments }] = await Promise.all([
    admin
      .from("finance_fixed_cost_allocations")
      .select("fixed_cost_id, source_name, share_percent")
      .in("fixed_cost_id", ids),
    paymentsQuery,
  ]);

  const costById = new Map(
    costs.map((row) => [
      row.id as string,
      {
        title: String(row.title ?? ""),
        vendor: (row.vendor_name as string | null) ?? null,
      },
    ]),
  );
  const allocByCost = new Map<string, { source_name: string; share_percent: number }[]>();
  for (const row of allocs ?? []) {
    const costId = String(row.fixed_cost_id);
    const list = allocByCost.get(costId) ?? [];
    list.push({
      source_name: String(row.source_name),
      share_percent: Number(row.share_percent),
    });
    allocByCost.set(costId, list);
  }

  const rows: CampaignExpense[] = [];
  for (const pay of payments ?? []) {
    const costId = String(pay.fixed_cost_id ?? "");
    if (!costId) continue;
    const cost = costById.get(costId);
    const shares = allocByCost.get(costId) ?? [];
    const amount = Number(pay.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    for (const share of shares) {
      const portion = Math.round(amount * (share.share_percent / 100) * 100) / 100;
      if (portion === 0) continue;
      rows.push({
        id: `finance:${pay.id}:${share.source_name}`,
        sourceName: share.source_name,
        channel: "manual",
        amount: portion,
        occurredAt: String(pay.occurred_at),
        note:
          [cost?.title, cost?.vendor, share.share_percent !== 100 ? `${share.share_percent}%` : null]
            .filter(Boolean)
            .join(" · ") || null,
      });
    }
  }
  return rows;
}

export async function loadMarketingBase(
  admin: ReturnType<typeof createAdminClient>,
  range?: DateRange,
): Promise<MarketingBaseState> {
  let expensesQuery = admin
    .from("marketing_campaign_expenses")
    .select("id, source_name, channel, amount, occurred_at, note")
    .order("occurred_at", { ascending: false });
  if (range?.from) expensesQuery = expensesQuery.gte("occurred_at", range.from);
  if (range?.to) expensesQuery = expensesQuery.lte("occurred_at", range.to);

  const [settings, flags, expenses, financeExpenses, employees, hours] = await Promise.all([
    admin.from("marketing_settings").select("profit_threshold, default_agent_multiplier").eq("id", 1).maybeSingle(),
    admin.from("marketing_campaigns").select("source_name, included"),
    expensesQuery,
    loadSourceFinanceExpenses(admin, range),
    admin.from("finance_employees").select("id, full_name, employment_kind, pay_contract").eq("is_active", true),
    admin.from("finance_employee_hours").select("employee_id, month, hours, days"),
  ]);

  const hoursByEmployee = new Map<string, Record<string, number>>();
  const vacationByEmployee = new Map<string, Record<string, number>>();
  if (!hours.error || isMissingRelation(hours.error.message)) {
    for (const row of hours.data ?? []) {
      const id = String(row.employee_id ?? "");
      const month = String(row.month ?? "");
      if (!id || !/^\d{4}-\d{2}$/.test(month)) continue;
      const current = hoursByEmployee.get(id) ?? {};
      current[month] = Number(row.hours) || 0;
      hoursByEmployee.set(id, current);
      const vacationDays = countVacationDays(parseAttendanceDays(row.days));
      if (vacationDays > 0) {
        const vac = vacationByEmployee.get(id) ?? {};
        vac[month] = vacationDays;
        vacationByEmployee.set(id, vac);
      }
    }
  }

  const error =
    (isMissingRelation(settings.error?.message) ? undefined : settings.error?.message) ||
    flags.error?.message ||
    expenses.error?.message ||
    (employees.error && !isMissingRelation(employees.error.message)
      ? employees.error.message
      : undefined) ||
    (hours.error && !isMissingRelation(hours.error.message) ? hours.error.message : undefined);

  const marketingExpenses: CampaignExpense[] = (expenses.data ?? []).map((row) => ({
    id: row.id,
    sourceName: row.source_name,
    channel: isChannel(row.channel) ? row.channel : "manual",
    amount: Number(row.amount),
    occurredAt: row.occurred_at,
    note: row.note,
  }));

  return {
    threshold: Number(settings.data?.profit_threshold ?? DEFAULT_PROFIT_THRESHOLD),
    defaultMultiplier: 0,
    flags: (flags.data ?? []).map((row) => ({
      sourceName: row.source_name,
      included: Boolean(row.included),
    })),
    expenses: [...financeExpenses, ...marketingExpenses],
    rates: [],
    payProfiles: (employees.data ?? []).map((row) => {
      const employmentKind = parseEmploymentKind(row.employment_kind);
      const agreements = parsePayAgreements(row.pay_contract, employmentKind).map(
        (agreement) => ({
          ...agreement,
          contract: withResolvedOneTimePayments(agreement.contract),
        }),
      );
      const current = currentAgreement(agreements)?.contract;
      return toPayProfile({
        fullName: String(row.full_name ?? ""),
        employmentKind,
        contract: current
          ?? withResolvedOneTimePayments(parsePayContract(row.pay_contract)),
        agreements,
        hoursByMonth: hoursByEmployee.get(String(row.id)),
        vacationDaysByMonth: vacationByEmployee.get(String(row.id)),
      });
    }),
    employeesLoaded:
      !employees.error || isMissingRelation(employees.error.message),
    error: error || undefined,
  };
}

export async function readMarketingFinanceBundle(
  statsRange?: DateRange,
): Promise<MarketingCampaignsState> {
  const admin = createAdminClient();
  const range = statsRange ?? { from: null, to: null };
  const [base, google, facebook] = await Promise.all([
    loadMarketingBase(admin, statsRange),
    loadGoogleAds(admin, statsRange),
    loadFacebookAds(admin, statsRange),
  ]);
  return {
    ...base,
    googleAds: google.connection,
    googleCampaigns: google.campaigns,
    googleStats: google.stats,
    googleSpendBySource: googleSpendBySource(google.campaigns, google.stats, range),
    facebookAds: facebook.connection,
    facebookCampaigns: facebook.campaigns,
    facebookStats: facebook.stats,
    facebookSpendBySource: facebookSpendBySource(facebook.campaigns, facebook.stats, range),
  };
}
