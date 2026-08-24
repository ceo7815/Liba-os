"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainRegion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const salesDashboard =
    pathname === "/sales-dashboard" || pathname.startsWith("/sales-dashboard/");

  return (
    <main
      className={cn(
        "flex-1",
        salesDashboard
          ? "flex min-h-0 flex-col overflow-hidden p-0"
          : "px-5 py-6 sm:px-8 sm:py-8",
      )}
    >
      {children}
    </main>
  );
}
