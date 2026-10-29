import type { Metadata } from "next";
import { ShemeshDesk } from "@/components/shemesh/desk";
import { field } from "@/lib/shemesh/field";
import { TaxRefundsScreen } from "@/components/shemesh/tax-refunds-screen";
import { createShemeshLedger, setShemeshLedgerStatus } from "@/app/actions/shemesh-ops";
import { loadDesk } from "@/lib/shemesh/ops";
import { taxReportFromWorkbook } from "@/lib/shemesh/tax-refunds";
import { loadTaxRefundWorkbook } from "@/lib/shemesh/tax-refunds-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "החזרי מס · שמש" };

export default async function ShemeshTaxRefundsPage() {
  const workbook = await loadTaxRefundWorkbook().catch(() => null);
  const report = taxReportFromWorkbook(workbook);
  const ledger = await loadDesk("ledger", "tax_refund");
  return (
    <div className="space-y-6">
      <TaxRefundsScreen fileName={report.fileName} rows={report.rows} statuses={report.statuses} />
      <ShemeshDesk
        title="ספר החזרי מס"
        description="עמלה לפי שיעור המס השמור. בלי שיעור, השורה נשמרת והעמלה נשארת ריקה."
        rows={ledger.rows}
        missing={ledger.missing}
        error={ledger.error}
        audit={ledger.audit}
        exportKind="ledger:tax_refund"
        createAction={createShemeshLedger}
        statusAction={setShemeshLedgerStatus}
      >
        <input type="hidden" name="kind" value="tax_refund" />
        <input className={field} name="clientName" placeholder="לקוח" required />
        <input className={field} name="gross" inputMode="decimal" placeholder="ברוטו" required />
        <input className={field} name="day" type="date" aria-label="תאריך" />
        <input className={field} name="notes" placeholder="הערה" />
        <input type="hidden" name="status" value="open" />
      </ShemeshDesk>
    </div>
  );
}
