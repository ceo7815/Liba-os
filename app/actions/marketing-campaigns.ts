"use server";

import { revalidatePath } from "next/cache";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";
import {
  canAccessSalesDashboard,
  canAccessSourcePnl,
  canViewEmployeeAgreements,
  canViewEmployees,
  getCurrentProfile,
  requireSourcePnlAccess,
} from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseMoneyInput } from "@/lib/finance/categories";
import { canonicalAgentName, type DateRange, type ExpenseChannel } from "@/lib/sales-dashboard/campaign-math";
import {
  loadMarketingBase,
  readMarketingFinanceBundle,
} from "@/lib/sales-dashboard/marketing-finance-bundle";
import { EMPTY_ADS_LEAD_SNAPSHOT, type AdsLeadSnapshot } from "@/lib/employees/lead-costs";

export type {
  MarketingBaseState,
  MarketingCampaignsState,
} from "@/lib/sales-dashboard/marketing-finance-bundle";

const CHANNELS = new Set<ExpenseChannel>(["google", "facebook", "manual"]);

function isChannel(value: string): value is ExpenseChannel {
  return CHANNELS.has(value as ExpenseChannel);
}

export async function loadMarketingBaseState(range?: DateRange) {
  await requireSourcePnlAccess();
  const admin = createAdminClient();
  return loadMarketingBase(admin, range);
}

export async function loadMarketingCampaignsState(statsRange?: DateRange) {
  await requireSourcePnlAccess();
  return readMarketingFinanceBundle(statsRange);
}

export async function loadAdsLeadSnapshot(): Promise<AdsLeadSnapshot> {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    (!canViewEmployees(profile) &&
      !canViewEmployeeAgreements(profile) &&
      !canAccessSourcePnl(profile) &&
      !canAccessSalesDashboard(profile))
  ) {
    return EMPTY_ADS_LEAD_SNAPSHOT;
  }
  const bundle = await readMarketingFinanceBundle();
  return {
    googleCampaigns: bundle.googleCampaigns,
    googleStats: bundle.googleStats,
    facebookCampaigns: bundle.facebookCampaigns,
    facebookStats: bundle.facebookStats,
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
