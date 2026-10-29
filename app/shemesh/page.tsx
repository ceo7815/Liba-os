import type { Metadata } from "next";
import { ShemeshOverview } from "@/components/shemesh/overview-screen";
import { buildGviyaModel, gviyaKpis, stageCounts } from "@/lib/shemesh/gviya";
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
  const kpis = gviyaKpis(model.deals, null);
  return (
    <ShemeshOverview
      books={books}
      stages={stageCounts(model.deals)}
      sold={kpis.sold}
      collected={kpis.collected}
      deals={kpis.count}
      hasWorkbook={model.deals.length > 0 || Boolean(stored?.sheets.length)}
    />
  );
}
