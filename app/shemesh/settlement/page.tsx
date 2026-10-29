import type { Metadata } from "next";
import { SettlementFlow } from "@/components/shemesh/settlement-flow";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { loadShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";
import { loadSettlementDrafts, loadSettlementStreams } from "@/lib/shemesh/settlement-flow";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התחשבנות מול ליבה · שמש" };

export default async function Page() {
  const [view, imported, books, streams, drafts] = await Promise.all([
    loadShemeshLibaSettlement(),
    loadInsurerSettlement(),
    loadShemeshBooks(),
    loadSettlementStreams(),
    loadSettlementDrafts(),
  ]);
  return (
    <div className="space-y-6">
    <SettlementScreen
      books={books}
      view={{
        ...view,
        licenseCommissions: imported.rows,
        licenseCommissionTotal: imported.missing ? null : imported.commission,
      }}
    />
    <SettlementFlow streams={streams} drafts={drafts.drafts} missing={drafts.missing} />
    </div>
  );
}
