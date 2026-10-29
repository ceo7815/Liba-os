import type { Metadata } from "next";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { loadShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התחשבנות מול ליבה · שמש" };

export default async function Page() {
  const [view, imported, books] = await Promise.all([
    loadShemeshLibaSettlement(),
    loadInsurerSettlement(),
    loadShemeshBooks(),
  ]);
  return (
    <SettlementScreen
      books={books}
      view={{
        ...view,
        licenseCommissions: imported.rows,
        licenseCommissionTotal: imported.missing ? null : imported.commission,
      }}
    />
  );
}
