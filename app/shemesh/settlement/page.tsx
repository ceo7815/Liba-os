import type { Metadata } from "next";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";

export const metadata: Metadata = { title: "התחשבנות · שמש" };

export default function Page() {
  return <SettlementScreen />;
}
