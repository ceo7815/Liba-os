import { isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { loadShemeshBooks } from "@/lib/shemesh/story";
import { formatShemeshMoney } from "@/lib/shemesh/format";

async function count(table: string, filter?: { column: string; value: string }): Promise<number | null> {
  try {
    const admin = shemeshAdmin();
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
  const [cases, redemptions, tax, leads, costs, debts, income, commissions, payroll, imported, books] = await Promise.all([
    count("shemesh_cases"),
    count("shemesh_ledger", { column: "kind", value: "redemption" }),
    count("shemesh_ledger", { column: "kind", value: "tax_refund" }),
    count("shemesh_revival_queue"),
    count("shemesh_rules", { column: "kind", value: "cost" }),
    count("shemesh_rules", { column: "kind", value: "debt" }),
    count("shemesh_rules", { column: "kind", value: "income" }),
    count("shemesh_rules", { column: "kind", value: "commission" }),
    count("shemesh_rules", { column: "kind", value: "payroll" }),
    count("shemesh_insurer_rows"),
    loadShemeshBooks(),
  ]);
  const text = (value: number | null, unit: string) => (value == null ? "ממתין למיגרציה" : `${value.toLocaleString("he-IL")} ${unit}`);
  return {
    "/shemesh/cases": text(cases, "תיקים"),
    "/shemesh/gviya": text(redemptions, "שורות פדיון"),
    "/shemesh/tax-refunds": text(tax, "שורות מס"),
    "/shemesh/insurance": text(imported, "שורות ייבוא"),
    "/shemesh/revival": text(leads, "בתור"),
    "/shemesh/costs": text(costs, "כללים"),
    "/shemesh/debts": text(debts, "חובות"),
    "/shemesh/income": books.missing ? text(income, "כללי הכנסה") : `נגבה ${formatShemeshMoney(books.collectedNet)}`,
    "/shemesh/commissions": text(commissions, "עמלות"),
    "/shemesh/payroll": text(payroll, "רשומות שכר"),
    "/shemesh/reports": books.missing ? "—" : `נגבה ${formatShemeshMoney(books.collectedNet)}`,
    "/shemesh/settlement": books.missing ? "—" : `עמלת רישיון ${formatShemeshMoney(books.licenseCommission)}`,
  };
}
