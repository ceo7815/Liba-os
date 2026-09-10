"use server";

import { loadMarketingBaseState } from "@/app/actions/marketing-campaigns";
import { requireFinanceAccess } from "@/lib/auth";
import { getFinanceCategory } from "@/lib/finance/categories";
import {
  adsSourceBrand,
  assignOperatingBrand,
  DEFAULT_OPERATING_BRAND,
  employeeLooksLikeShemesh,
  matchesOperatingBrand,
  parseOperatingBrand,
  textHasShemeshToken,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_AGENT_MULTIPLIER,
  DEFAULT_INSURER_MULTIPLIER,
  DATE_PRESET_LABEL,
  campaignPnl,
  formatRangeDisplay,
  inDateRange,
  rangeForPreset,
  type DatePreset,
  type DateRange,
} from "@/lib/sales-dashboard/campaign-math";
import { wageForContractProductions, productionDateOf } from "@/lib/employees/contract";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";

export type GeneralPlFixedRow = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  group: string;
  expected: number | null;
  paid: number;
  status: "paid" | "partial" | "unpaid" | "no_amount";
};

export type GeneralPlSnapshot = {
  preset: DatePreset;
  from: string | null;
  to: string | null;
  periodLabel: string;
  rangeDisplay: string;
  excel: {
    insurerMultiplier: number;
    agentMultiplierDefault: number;
    closures: number;
    premium: number;
    income: number;
    wageTotal: number;
    adsTotal: number;
    expenseTotal: number;
    net: number;
    fixedExpected: number;
    /** Net after also subtracting catalog fixed overheads (expected). */
    netAfterFixed: number;
    excelAsOf: string | null;
    error: string | null;
  };
  fixed: {
    expectedTotal: number;
    paidTotal: number;
    unpaidCount: number;
    monthsCovered: number;
    rows: GeneralPlFixedRow[];
  };
};

function monthsCovered(from: string | null, to: string | null): number {
  if (!from || !to) return 12;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return 1;
  const n = (ty - fy) * 12 + (tm - fm) + 1;
  return Math.max(1, Math.min(120, n));
}

function resolveRange(input?: {
  preset?: string;
  from?: string | null;
  to?: string | null;
}): { preset: DatePreset; range: DateRange } {
  const allowed: DatePreset[] = ["ytd", "month", "prev", "90d", "all", "custom"];
  const preset = (
    allowed.includes(input?.preset as DatePreset)
      ? input!.preset
      : "ytd"
  ) as DatePreset;

  if (preset === "custom") {
    return {
      preset,
      range: {
        from: input?.from?.trim() || null,
        to: input?.to?.trim() || null,
      },
    };
  }
  return { preset, range: rangeForPreset(preset, { from: null, to: null }) };
}

export async function getGeneralPlSnapshot(input?: {
  preset?: string;
  from?: string | null;
  to?: string | null;
  brand?: string | null;
}): Promise<{ error: string | null; snapshot: GeneralPlSnapshot | null }> {
  await requireFinanceAccess();
  const { preset, range } = resolveRange(input);
  const brand: OperatingBrandId =
    parseOperatingBrand(input?.brand) ?? DEFAULT_OPERATING_BRAND;
  const months = monthsCovered(range.from, range.to);

  const [marketing, excelResult, fixedCatalog, employeesRes] = await Promise.all([
    loadMarketingBaseState().catch((err: unknown) => ({
      error: err instanceof Error ? err.message : "שגיאת שיווק",
      rates: [],
      payProfiles: [],
      expenses: [],
      insurerMultiplier: DEFAULT_INSURER_MULTIPLIER,
      defaultMultiplier: DEFAULT_AGENT_MULTIPLIER,
      threshold: 1,
      flags: [],
    })),
    getSalesDashboardSnapshot()
      .then((data) => ({ data, error: null as string | null }))
      .catch((err: unknown) => ({
        data: null,
        error: err instanceof Error ? err.message : "טעינת אקסל נכשלה",
      })),
    createAdminClient()
      .from("finance_fixed_costs")
      .select("id, title, category, default_amount, sort_order, is_active, notes, vendor_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    createAdminClient()
      .from("finance_employees")
      .select("full_name, wait_circle, notes, is_active")
      .eq("is_active", true),
  ]);

  const insurerMultiplier =
    "insurerMultiplier" in marketing
      ? marketing.insurerMultiplier
      : DEFAULT_INSURER_MULTIPLIER;
  const defaultMultiplier =
    "defaultMultiplier" in marketing
      ? marketing.defaultMultiplier
      : DEFAULT_AGENT_MULTIPLIER;
  const rates = "rates" in marketing ? marketing.rates : [];
  const payProfiles = "payProfiles" in marketing ? marketing.payProfiles : [];
  const expenses = "expenses" in marketing ? marketing.expenses : [];
  const shemeshEmployeeNames = (employeesRes.data ?? [])
    .filter((row) =>
      employeeLooksLikeShemesh({
        fullName: row.full_name as string | null,
        waitCircle: row.wait_circle as string | null,
        notes: row.notes as string | null,
      }),
    )
    .map((row) => String(row.full_name ?? "").trim())
    .filter(Boolean);

  const productions = (excelResult.data?.marketing?.productions ?? []).filter((row) =>
    matchesOperatingBrand(
      assignOperatingBrand({
        agent: row.agent,
        source: row.source,
        shemeshEmployeeNames,
      }),
      brand,
    ),
  );
  const activeInRange = productions.filter(
    (row) => row.status === "active" && inDateRange(productionDateOf(row), range),
  );
  const premium = Math.round(
    activeInRange.reduce((sum, row) => sum + row.premium, 0),
  );
  const wageTotal = wageForContractProductions(activeInRange, {
    profiles: payProfiles ?? [],
    rates,
    fallback: 0,
    kind: "all",
  });
  const adsTotal = Math.round(
    expenses
      .filter(
        (row) =>
          inDateRange(row.occurredAt, range) &&
          matchesOperatingBrand(adsSourceBrand(row.sourceName), brand),
      )
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const pnl = campaignPnl({
    premium,
    wageTotal,
    adsTotal,
    insurerMultiplier,
  });

  const costRows = (fixedCatalog.data ?? []).filter((row) => {
    if (brand === "all") return true;
    const shemesh =
      textHasShemeshToken(String(row.title ?? "")) ||
      textHasShemeshToken(String(row.notes ?? "")) ||
      textHasShemeshToken(String(row.vendor_name ?? ""));
    if (brand === "shemesh") return shemesh;
    return !shemesh;
  });
  const fixedRows: GeneralPlFixedRow[] = costRows.map((row) => {
    const category = String(row.category);
    const def = getFinanceCategory(category);
    const monthly =
      row.default_amount == null ? null : Number(row.default_amount);
    const expected =
      monthly == null ? null : Math.round(monthly * months * 100) / 100;
    let status: GeneralPlFixedRow["status"] = "unpaid";
    if (expected == null || expected <= 0) status = "no_amount";
    return {
      id: String(row.id),
      title: String(row.title),
      category,
      categoryLabel: def?.label ?? category,
      group: def?.group ?? "אחר",
      expected,
      paid: 0,
      status,
    };
  });

  const expectedTotal = fixedRows.reduce((s, r) => s + (r.expected ?? 0), 0);
  const paidScheduleTotal = 0;
  const unpaidCount = fixedRows.filter((r) => r.status === "unpaid").length;

  const netAfterFixed = pnl.net - expectedTotal;

  const periodLabel =
    preset === "custom" && range.from && range.to
      ? `${range.from} → ${range.to}`
      : DATE_PRESET_LABEL[preset];

  return {
    error: null,
    snapshot: {
      preset,
      from: range.from,
      to: range.to,
      periodLabel,
      rangeDisplay: formatRangeDisplay(preset, range),
      excel: {
        insurerMultiplier,
        agentMultiplierDefault: defaultMultiplier,
        closures: activeInRange.length,
        premium,
        income: pnl.income,
        wageTotal,
        adsTotal,
        expenseTotal: pnl.expenseTotal,
        net: pnl.net,
        fixedExpected: expectedTotal,
        netAfterFixed,
        excelAsOf: excelResult.data?.syncedAt ?? null,
        error:
          excelResult.error ||
          ("error" in marketing ? marketing.error ?? null : null) ||
          null,
      },
      fixed: {
        expectedTotal,
        paidTotal: paidScheduleTotal,
        unpaidCount,
        monthsCovered: months,
        rows: fixedRows,
      },
    },
  };
}
