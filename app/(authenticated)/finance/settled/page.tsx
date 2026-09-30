import type { Metadata } from "next";
import { SourcePnlScreen } from "@/components/marketing-dashboard/marketing-dashboard-screen";
import { requireSettledCommissionsAccess } from "@/lib/auth";
import { canAccessSourcePnl } from "@/lib/finance/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "רווח לפי מקור",
};

export default async function SettledCommissionsPage() {
  const profile = await requireSettledCommissionsAccess();
  return (
    <SourcePnlScreen
      kind="settled"
      modes={{ volume: canAccessSourcePnl(profile), settled: true }}
    />
  );
}
