import type { Metadata } from "next";
import { ShemeshRevenue } from "@/components/shemesh/revenue-screen";
import { presentShemeshWorkbook } from "@/lib/shemesh/sales-excel-view";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הכנסות שמש",
};

const LEDGER_NAMES = new Set(["גבייה", "חשבוניות", "פיננסים"]);

export default async function ShemeshRevenuePage() {
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const presented = stored ? presentShemeshWorkbook(stored) : null;
  const workbook = presented
    ? { ...presented, sheets: presented.sheets.filter((sheet) => LEDGER_NAMES.has(sheet.name)) }
    : null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">מקור הגבייה: {SHEMESH_SALES_SOURCE_LABEL}. לא מדוח המנהלים של ליבה.</p>
      <ShemeshRevenue workbook={workbook} />
    </div>
  );
}
