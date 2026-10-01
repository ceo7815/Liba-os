"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainRegion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const salesExcel = pathname === "/sales-dashboard/excel";

  return (
    <main
      className={cn(
        "flex-1",
        salesExcel
          ? "fixed bottom-0 end-0 start-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-0 flex flex-col overflow-hidden p-0 lg:start-64"
          : "flex-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-8",
      )}
    >
      {children}
    </main>
  );
}
