import type { Metadata } from "next";
import { InsuranceScreen } from "@/components/shemesh/insurance-screen";

export const metadata: Metadata = { title: "ביטוח · שמש" };

export default function Page() {
  return <InsuranceScreen />;
}
