import type { Metadata } from "next";
import { SalesExcelReportScreen } from "@/components/sales-dashboard/sales-excel-report-screen";
import { requireSalesDashboardAccess } from "@/lib/auth";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";
import { resolveSalesExcelWorkbook } from "@/lib/sales-dashboard/workbook-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דוח אקסל מכירות",
};

export default async function SalesExcelReportPage() {
  await requireSalesDashboardAccess();
  const snapshot = await getSalesDashboardSnapshot().catch(() => null);
  const initial = await resolveSalesExcelWorkbook(snapshot).catch(() => null);
  return <SalesExcelReportScreen initial={initial} />;
}
