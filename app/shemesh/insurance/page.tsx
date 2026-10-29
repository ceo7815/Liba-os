import type { Metadata } from "next";
import { InsuranceScreen } from "@/components/shemesh/insurance-screen";
import { InsurerImport } from "@/components/shemesh/insurer-import";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ביטוח · שמש" };

export default async function Page() {
  const imported = await loadInsurerSettlement();
  return (
    <div className="space-y-6">
      <InsurerImport history={imported.history} />
      <InsuranceScreen />
    </div>
  );
}
