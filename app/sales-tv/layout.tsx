import { Heebo } from "next/font/google";
import "@/components/sales-dashboard/sales-tv.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export default function SalesTvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${heebo.className} min-h-screen bg-[#f4f4f1]`}>
      {children}
    </div>
  );
}
