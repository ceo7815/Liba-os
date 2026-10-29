import { Suspense } from "react";
import type { Metadata } from "next";
import { SalesExcelReportScreen } from "@/components/sales-dashboard/sales-excel-report-screen";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דוח מכירות שמש",
};

export default async function ShemeshSalesPage() {
  const initial = await loadShemeshSalesWorkbook().catch(() => null);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">מקור: {SHEMESH_SALES_SOURCE_LABEL}. לא מדוח המנהלים של ליבה.</p>
      <Suspense fallback={null}>
        <SalesExcelReportScreen initial={initial} company="shemesh" />
      </Suspense>
    </div>
  );
}
