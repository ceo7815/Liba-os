import type { Metadata } from "next";
import { GviyaScreen } from "@/components/shemesh/gviya-screen";
import { buildGviyaModel } from "@/lib/shemesh/gviya";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { matchStoredSnapshot } from "@/lib/shemesh/surense-match";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "פדיונות · שמש" };

export default async function ShemeshGviyaPage() {
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const model = buildGviyaModel(stored);
  const match = await matchStoredSnapshot(model.deals, model.contacts);
  const flag = (id: string, found: Set<string>) =>
    !match.configured ? "unchecked" : found.has(id) ? "matched" : "unmatched";
  return (
    <GviyaScreen
      fileName={model.fileName}
      syncedAt={model.syncedAt}
      deals={model.deals.map((deal) => ({ ...deal, surense: flag(deal.id, match.dealMatched) }))}
      contacts={model.contacts.map((contact) => ({ ...contact, surense: flag(contact.id, match.contactFound) }))}
      reps={model.reps}
      sources={model.sources}
      surenseError={match.error}
      surenseConfigured={match.configured}
      scanned={match.scanned}
    />
  );
}
