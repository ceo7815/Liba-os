import type { Metadata } from "next";
import { MoneyDesk } from "@/components/shemesh/money-desk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הכנסות שמש" };

export default function Page() {
  return <MoneyDesk kind="income" month={new Date().toISOString().slice(0, 7)} />;
}
