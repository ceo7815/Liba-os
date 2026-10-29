import type { Metadata } from "next";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { loadShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התחשבנות מול ליבה · שמש" };

export default async function Page() {
  const view = await loadShemeshLibaSettlement();
  return <SettlementScreen view={view} />;
}
