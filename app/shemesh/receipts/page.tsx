import type { Metadata } from "next";
import { ReceiptsScreen } from "@/components/shemesh/receipts-screen";

export const metadata: Metadata = { title: "קבלות · שמש" };

export default function Page() {
  return <ReceiptsScreen />;
}
