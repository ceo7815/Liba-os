import type { Metadata } from "next";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { loadShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התחשבנות מול ליבה · שמש" };

export default async function Page() {
  const view = await loadShemeshLibaSettlement();
  const imported = await loadInsurerSettlement();
  return (
    <SettlementScreen
      view={{
        ...view,
        licenseCommissions: imported.rows,
        licenseCommissionTotal: imported.missing ? null : imported.commission,
      }}
    />
  );
}
