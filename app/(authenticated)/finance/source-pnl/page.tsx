import type { Metadata } from "next";
import { SourcePnlScreen } from "@/components/marketing-dashboard/marketing-dashboard-screen";
import { requireSourcePnlAccess } from "@/lib/auth";
import { canAccessSettledCommissions } from "@/lib/finance/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "רווח לפי מקור",
};

export default async function SourcePnlPage() {
  const profile = await requireSourcePnlAccess();
  return (
    <SourcePnlScreen
      kind="volume"
      modes={{ volume: true, settled: canAccessSettledCommissions(profile) }}
    />
  );
}
