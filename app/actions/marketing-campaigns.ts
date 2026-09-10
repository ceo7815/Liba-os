"use server";

import { revalidatePath } from "next/cache";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";
import { requireSourcePnlAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseMoneyInput } from "@/lib/finance/categories";
import { readGoogleAdsBundle, type GoogleAdsConnection } from "@/app/actions/google-ads";
import { readFacebookAdsBundle, type FacebookAdsConnection } from "@/app/actions/facebook-ads";
import {
  DEFAULT_INSURER_MULTIPLIER,
  DEFAULT_PROFIT_THRESHOLD,
  canonicalAgentName,
  type AgentRate,
  type CampaignExpense,
  type CampaignFlag,
  type ExpenseChannel,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
  type DateRange,
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

const CHANNELS = new Set<ExpenseChannel>(["google", "facebook", "manual"]);

function isChannel(value: string): value is ExpenseChannel {
  return CHANNELS.has(value as ExpenseChannel);
}

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(
    message &&
      (/does not exist/i.test(message) || /schema cache/i.test(message) || /could not find/i.test(message)),
  );
}

export type MarketingCampaignsState = {
  threshold: number;
  defaultMultiplier: number;
  insurerMultiplier: number;
  flags: CampaignFlag[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles: EmployeePayProfile[];
  googleAds: GoogleAdsConnection;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  facebookAds: FacebookAdsConnection;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  error?: string;
};

export type MarketingBaseState = {
  threshold: number;
  defaultMultiplier: number;
  insurerMultiplier: number;
  flags: CampaignFlag[];
  expenses: CampaignExpense[];
  rates: AgentRate[];
  payProfiles: EmployeePayProfile[];
  error?: string;
};

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

async function loadMarketingBase(
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
    (hours.error && !isMissingRelation(hours.error.message) ? hours.error.message : undefined);

  const insurerMultiplier = DEFAULT_INSURER_MULTIPLIER;

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
    insurerMultiplier: Number.isFinite(insurerMultiplier) && insurerMultiplier >= 0
      ? insurerMultiplier
      : DEFAULT_INSURER_MULTIPLIER,
    flags: (flags.data ?? []).map((row) => ({
      sourceName: row.source_name,
      included: Boolean(row.included),
    })),
    // Finance expenses allocated to sources land in the cube; legacy marketing rows still included.
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
    error: error || undefined,
  };
}

export async function loadMarketingBaseState(
  range?: DateRange,
): Promise<MarketingBaseState> {
  await requireSourcePnlAccess();
  const admin = createAdminClient();
  return loadMarketingBase(admin, range);
}

export async function loadMarketingCampaignsState(
  statsRange?: DateRange,
): Promise<MarketingCampaignsState> {
  await requireSourcePnlAccess();
  const admin = createAdminClient();

  const [base, google, facebook] = await Promise.all([
    loadMarketingBase(admin, statsRange),
    readGoogleAdsBundle(statsRange),
    readFacebookAdsBundle(statsRange),
  ]);

  return {
    ...base,
    googleAds: google.connection,
    googleCampaigns: google.campaigns,
    googleStats: google.stats,
    facebookAds: facebook.connection,
    facebookCampaigns: facebook.campaigns,
    facebookStats: facebook.stats,
  };
}

export async function saveCampaignThreshold(
  value: number,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  if (!Number.isFinite(value) || value <= 0 || value > 10) {
    return { ok: false, error: "סף לא תקין" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_settings").upsert({
    id: 1,
    profit_threshold: value,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function setCampaignIncluded(
  sourceName: string,
  included: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const name = sourceName.trim();
  if (!name) return { ok: false, error: "חסר שם קמפיין" };
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_campaigns").upsert({
    source_name: name,
    included,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function addCampaignExpense(input: {
  sourceName: string;
  channel: string;
  amount: string;
  occurredAt: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const sourceName = input.sourceName.trim();
  if (!sourceName) return { ok: false, error: "חסר קמפיין" };
  if (!isChannel(input.channel)) return { ok: false, error: "ערוץ לא תקין" };
  const amount = parseMoneyInput(input.amount);
  if (amount == null || amount <= 0) return { ok: false, error: "סכום לא תקין" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredAt)) {
    return { ok: false, error: "תאריך לא תקין" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_campaign_expenses").insert({
    source_name: sourceName,
    channel: input.channel,
    amount,
    occurred_at: input.occurredAt,
    note: input.note?.trim() || null,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function deleteCampaignExpense(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSourcePnlAccess();
  if (!id) return { ok: false, error: "חסר מזהה" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_campaign_expenses")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function saveAgentMultiplier(
  agentName: string,
  multiplier: number,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  const name = agentName.trim();
  if (!name || name === "—") return { ok: false, error: "חסר שם עובד" };
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 100) {
    return { ok: false, error: "מכפיל לא תקין" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_agent_rates").upsert({
    agent_name: canonicalAgentName(name) || name,
    multiplier,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  revalidatePath("/employees");
  revalidatePath("/employees/payroll");
  return { ok: true };
}

export async function saveDefaultAgentMultiplier(
  value: number,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, error: "מכפיל לא תקין" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_settings").upsert({
    id: 1,
    default_agent_multiplier: value,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}

export async function saveInsurerMultiplier(
  value: number,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireSourcePnlAccess();
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, error: "מכפיל לא תקין" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_settings").upsert({
    id: 1,
    insurer_multiplier: value,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(SOURCE_PNL_PATH);
  return { ok: true };
}
