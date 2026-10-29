import type { Metadata } from "next";
import { MoneyDesk } from "@/components/shemesh/money-desk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הוצאות קבועות · שמש" };

export default function Page() {
  const month = new Date().toISOString().slice(0, 7);
  return <MoneyDesk kind="cost" month={month} />;
}
