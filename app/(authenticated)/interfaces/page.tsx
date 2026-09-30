import type { Metadata } from "next";
import { InterfacesScreen } from "@/components/interfaces/interfaces-screen";
import { requireInterfacesAccess } from "@/lib/auth";
import { loadConnectedInterfaces } from "@/lib/interfaces/status";

export const metadata: Metadata = {
  title: "ממשקים מחוברים",
};

export default async function InterfacesPage() {
  await requireInterfacesAccess();
  const items = await loadConnectedInterfaces();
  return <InterfacesScreen items={items} />;
}
