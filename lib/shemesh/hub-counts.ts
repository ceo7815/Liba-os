import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/shemesh/db";

async function count(table: string, filter?: { column: string; value: string }): Promise<number | null> {
  try {
    const admin = createAdminClient();
    let query = admin.from(table).select("id", { count: "exact", head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count: total, error } = await query;
    if (error) return isMissingRelation(error.message) ? null : null;
    return total ?? 0;
  } catch {
    return null;
  }
}

export async function loadHubNumbers(): Promise<Record<string, string>> {
  const [cases, redemptions, tax, leads, costs, debts, income, commissions, payroll] = await Promise.all([
    count("shemesh_cases"),
    count("shemesh_ledger", { column: "kind", value: "redemption" }),
    count("shemesh_ledger", { column: "kind", value: "tax_refund" }),
    count("shemesh_revival_queue"),
    count("shemesh_rules", { column: "kind", value: "cost" }),
    count("shemesh_rules", { column: "kind", value: "debt" }),
    count("shemesh_rules", { column: "kind", value: "income" }),
    count("shemesh_rules", { column: "kind", value: "commission" }),
    count("shemesh_rules", { column: "kind", value: "payroll" }),
  ]);
  const text = (value: number | null, unit: string) => (value == null ? "ממתין למיגרציה" : `${value.toLocaleString("he-IL")} ${unit}`);
  return {
    "/shemesh/cases": text(cases, "תיקים"),
    "/shemesh/gviya": text(redemptions, "שורות פדיון"),
    "/shemesh/tax-refunds": text(tax, "שורות מס"),
    "/shemesh/revival": text(leads, "בתור"),
    "/shemesh/costs": text(costs, "כללים"),
    "/shemesh/debts": text(debts, "חובות"),
    "/shemesh/income": text(income, "כללי הכנסה"),
    "/shemesh/commissions": text(commissions, "עמלות"),
    "/shemesh/payroll": text(payroll, "רשומות שכר"),
  };
}
