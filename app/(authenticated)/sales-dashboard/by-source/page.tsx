import type { Metadata } from "next";
import { OperatingBrandProvider } from "@/components/finance/operating-brand-bar";
import { SalesBySourceScreen } from "@/components/sales-dashboard/sales-by-source-screen";
import { requireSalesDashboardAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "פילוח מכירות",
};

export default async function SalesBySourcePage() {
  await requireSalesDashboardAccess();

  return (
    <OperatingBrandProvider lockedBrand="liba">
      <SalesBySourceScreen />
    </OperatingBrandProvider>
  );
}
