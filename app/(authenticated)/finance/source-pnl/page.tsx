import type { Metadata } from "next";
import { SourcePnlScreen } from "@/components/marketing-dashboard/marketing-dashboard-screen";
import { requireSourcePnlAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "רווח והפסד לפי מקור (היקף)",
};

export default async function SourcePnlPage() {
  await requireSourcePnlAccess();
  return <SourcePnlScreen kind="volume" />;
}
