import type { Metadata } from "next";
import { AgencyScreen } from "@/components/shemesh/agency-screen";
import { loadShemeshSurenseView } from "@/lib/shemesh/surense-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שורנס · שמש" };

export default async function Page() {
  const view = await loadShemeshSurenseView();
  return <AgencyScreen missing={view.missing} error={view.error} rows={view.rows} />;
}
