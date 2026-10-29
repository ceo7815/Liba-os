import type { Metadata } from "next";
import { TaxRefundsScreen } from "@/components/shemesh/tax-refunds-screen";
import { taxReportFromWorkbook } from "@/lib/shemesh/tax-refunds";
import { loadTaxRefundWorkbook } from "@/lib/shemesh/tax-refunds-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "החזרי מס · שמש" };

export default async function ShemeshTaxRefundsPage() {
  const workbook = await loadTaxRefundWorkbook().catch(() => null);
  const report = taxReportFromWorkbook(workbook);
  return <TaxRefundsScreen fileName={report.fileName} rows={report.rows} statuses={report.statuses} />;
}
