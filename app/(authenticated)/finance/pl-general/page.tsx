import type { Metadata } from "next";
import { GeneralPlScreen } from "@/components/finance/general-pl-screen";
import { requireFinanceAccess } from "@/lib/auth";
import type { DatePreset } from "@/lib/sales-dashboard/campaign-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דוח רווח והפסד כללי",
};

type PageProps = {
  searchParams?: {
    preset?: string;
    from?: string;
    to?: string;
  };
};

const ALLOWED: DatePreset[] = ["ytd", "month", "prev", "90d", "all", "custom"];

export default async function GeneralPlPage({ searchParams }: PageProps) {
  await requireFinanceAccess();
  const raw = searchParams?.preset ?? "ytd";
  const preset = (ALLOWED.includes(raw as DatePreset) ? raw : "ytd") as DatePreset;

  return (
    <GeneralPlScreen
      initialPreset={preset}
      initialFrom={searchParams?.from ?? null}
      initialTo={searchParams?.to ?? null}
    />
  );
}
