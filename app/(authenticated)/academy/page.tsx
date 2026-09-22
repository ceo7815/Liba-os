import type { Metadata } from "next";
import { getMyAcademyDashboard } from "@/app/actions/academy";
import { AcademyDashboardScreen } from "@/components/academy/academy-dashboard";
import { requireAcademyAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "הדרכה" };
export const dynamic = "force-dynamic";

export default async function AcademyPage() {
  await requireAcademyAccess();
  const result = await getMyAcademyDashboard();
  if (!result.ok) {
    return <p className="text-sm text-red-600">{result.error}</p>;
  }
  return <AcademyDashboardScreen data={result.data} />;
}
