import type { Metadata } from "next";
import { MoneyDesk } from "@/components/shemesh/money-desk";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Wallet } from "lucide-react";
import { shemeshProfile } from "@/lib/shemesh/actor";
import { canViewShemeshPayroll } from "@/lib/permissions/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שכר · שמש" };

export default async function Page() {
  const profile = await shemeshProfile();
  if (!canViewShemeshPayroll(profile)) {
    return (
      <ShemeshEmpty
        icon={Wallet}
        title="שכר פתוח רק לכספים"
        body="בעלים, מנכ״ל ובעלי shemesh.finance רואים את השכר. מטפל ומנהל תפעול לא."
      />
    );
  }
  return <MoneyDesk kind="payroll" month={new Date().toISOString().slice(0, 7)} />;
}
