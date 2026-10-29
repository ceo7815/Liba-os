import type { Metadata } from "next";
import { ShemeshDashboard } from "@/components/shemesh/dashboard-screen";
import { loadShemeshDashboard } from "@/lib/shemesh/dashboard-load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שמש" };

export default async function ShemeshHomePage() {
  const data = await loadShemeshDashboard();
  return <ShemeshDashboard input={data.input} sourceOptions={data.sourceOptions} />;
}