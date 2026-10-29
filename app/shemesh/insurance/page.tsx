import type { Metadata } from "next";
import { InsuranceScreen } from "@/components/shemesh/insurance-screen";
import { InsurerImport } from "@/components/shemesh/insurer-import";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";
import { loadFeeSettings, loadInsurerProductions } from "@/lib/shemesh/ops";
import { settledCommission } from "@/lib/shemesh/lifecycle";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ביטוח · שמש" };

export default async function Page() {
  const [imported, productions, fees] = await Promise.all([
    loadInsurerSettlement(),
    loadInsurerProductions(),
    loadFeeSettings(),
  ]);
  const settled = productions.rows.filter((row) => row.status === "fully_settled");
  const income = settled.reduce((sum, row) => {
    const line = settledCommission(row.premium, fees.settings.feeMultiplier, row.status, fees.settings.multiplierPending);
    return sum + (line.income ?? 0);
  }, 0);
  return (
    <div className="space-y-6">
      <Panel title="נפרעים">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="שורות שנסגרו" value={productions.missing ? "—" : formatShemeshCount(settled.length)} hint="רק שורה שסומנה כנסגרה במלואה" />
          <Stat label="הכנסת עמלה" value={fees.settings.multiplierPending || fees.settings.feeMultiplier == null ? "—" : formatShemeshMoney(income)} hint={fees.settings.multiplierPending ? "המכפיל ממתין לאימות" : "הפקה כפול המכפיל השמור"} />
          <Stat label="כל השורות שיובאו" value={productions.missing ? "—" : formatShemeshCount(productions.rows.length)} />
        </div>
      </Panel>
      <InsurerImport history={imported.history} />
      <InsuranceScreen />
    </div>
  );
}
