import type { Metadata } from "next";
import { ShemeshOverview } from "@/components/shemesh/overview-screen";
import { buildGviyaModel, currentMonthKey, stageCounts } from "@/lib/shemesh/gviya";
import { monthSalesFromDeals } from "@/lib/shemesh/sales-source";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שמש" };

export default async function ShemeshHomePage() {
  const [stored, books] = await Promise.all([
    loadShemeshSalesWorkbook().catch(() => null),
    loadShemeshBooks(),
  ]);
  const model = buildGviyaModel(stored);
  const hasWorkbook = model.deals.length > 0 || Boolean(stored?.sheets.length);
  const sales = monthSalesFromDeals(hasWorkbook ? model.deals : [], currentMonthKey());
  return (
    <ShemeshOverview
      books={books}
      stages={stageCounts(hasWorkbook ? model.deals : [])}
      sales={sales}
      hasWorkbook={hasWorkbook}
    />
  );
}
