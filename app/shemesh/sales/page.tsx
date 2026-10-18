import { Suspense } from "react";
import type { Metadata } from "next";
import { SalesExcelReportScreen } from "@/components/sales-dashboard/sales-excel-report-screen";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דוח מכירות שמש",
};

export default async function ShemeshSalesPage() {
  const initial = await loadShemeshSalesWorkbook().catch(() => null);
  return (
    <Suspense fallback={null}>
      <SalesExcelReportScreen initial={initial} company="shemesh" />
    </Suspense>
  );
}
