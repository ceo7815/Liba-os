import type { Metadata } from "next";
import { ShemeshRevenue } from "@/components/shemesh/revenue-screen";
import { presentShemeshWorkbook } from "@/lib/shemesh/sales-excel-view";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";

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
  return <ShemeshRevenue workbook={workbook} />;
}
