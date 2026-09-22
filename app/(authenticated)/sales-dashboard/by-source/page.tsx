import type { Metadata } from "next";
import {
  OperatingBrandBar,
  OperatingBrandProvider,
} from "@/components/finance/operating-brand-bar";
import { SalesBySourceScreen } from "@/components/sales-dashboard/sales-by-source-screen";
import { requireSalesDashboardAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מכירות לפי מקור",
};

export default async function SalesBySourcePage() {
  await requireSalesDashboardAccess();

  return (
    <OperatingBrandProvider>
      <div className="mb-4 sm:mb-6">
        <OperatingBrandBar />
      </div>
      <SalesBySourceScreen />
    </OperatingBrandProvider>
  );
}
