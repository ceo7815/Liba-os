import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LeadControlScreen } from "@/components/lead-control/screen";
import { loadLeadControl } from "@/lib/lead-control/load";
import { requireProfile } from "@/lib/auth";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const metadata: Metadata = {
  title: "בקרת לידים",
};

export default async function LeadControlPage() {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile)) redirect("/dashboard");
  const snapshot = await loadLeadControl();
  return <LeadControlScreen snapshot={snapshot} />;
}
