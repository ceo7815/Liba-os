import type { Metadata } from "next";
import { SourcePnlScreen } from "@/components/marketing-dashboard/marketing-dashboard-screen";
import { requireSettledCommissionsAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "רווח והפסד לפי מקור (נפרעים)",
};

export default async function SettledCommissionsPage() {
  await requireSettledCommissionsAccess();
  return <SourcePnlScreen kind="settled" />;
}
