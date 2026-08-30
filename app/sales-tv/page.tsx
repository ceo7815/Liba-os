import type { Metadata } from "next";
import { getSalesDashboardSnapshot } from "@/lib/sales-dashboard/snapshot";
import { SalesTvScreen } from "@/components/sales-dashboard/sales-tv-screen";
import { authorizeSalesTvPage } from "@/lib/sales-dashboard/kiosk-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "דשבורד מכירות",
};

type PageProps = {
  searchParams: { token?: string };
};

export default async function SalesTvPage({ searchParams }: PageProps) {
  const token = searchParams.token ?? "";
  if (!(await authorizeSalesTvPage(token || undefined))) {
    return (
      <div className="sales-tv-denied">
        <div>
          <h1>אין גישה למסך הטלוויזיה</h1>
          <p>
            פתחו את הכתובת עם טוקן הקיוסק, או היכנסו לדשבורד המכירות מתוך ליבה
            OS אחרי התחברות כמנהל.
          </p>
        </div>
      </div>
    );
  }

  return <SalesTvScreen token={token || undefined} initialData={await getSalesDashboardSnapshot()} />;
}
