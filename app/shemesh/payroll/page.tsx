import type { Metadata } from "next";
import { PayrollScreen } from "@/components/shemesh/payroll-screen";

export const metadata: Metadata = { title: "שכר · שמש" };

export default function Page() {
  return <PayrollScreen />;
}
