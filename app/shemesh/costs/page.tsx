import type { Metadata } from "next";
import { FixedCostsScreen } from "@/components/shemesh/costs-screen";

export const metadata: Metadata = { title: "הוצאות קבועות · שמש" };

export default function Page() {
  return <FixedCostsScreen />;
}
