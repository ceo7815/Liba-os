import type { Metadata } from "next";
import { InsuranceAgreementsScreen } from "@/components/finance/insurance-agreements-screen";
import { requireFinanceAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הסכמים חברות ביטוח",
};

export default async function InsuranceAgreementsPage() {
  await requireFinanceAccess();
  return <InsuranceAgreementsScreen />;
}
