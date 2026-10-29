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
          ? "fixed end-0 start-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-0 flex flex-col overflow-hidden p-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-0 lg:start-64"
          : "min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-8",
      )}
    >
      <div key={pathname} className="enter flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </main>
  );
}
