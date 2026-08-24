import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { SalesTvScreen } from "@/components/sales-dashboard/sales-tv-screen";
import { requireSalesDashboardAccess } from "@/lib/auth";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "דשבורד מכירות",
};

export default async function SalesDashboardPage() {
  await requireSalesDashboardAccess();

  return (
    <section
      className={`${heebo.className} flex min-h-0 min-w-0 flex-1 flex-col`}
    >
      <SalesTvScreen embedded />
    </section>
  );
}
