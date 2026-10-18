import type { Metadata } from "next";
import { PortfolioReportScreen } from "@/components/shemesh/portfolio-report-screen";

export const metadata: Metadata = { title: "השוואת תיק · שמש" };

export default function ShemeshPortfolioReportPage() {
  return <PortfolioReportScreen />;
}
