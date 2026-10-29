"use client";

import { usePathname } from "next/navigation";

/** Short page enter. The class is disabled under prefers-reduced-motion. */
export function RouteEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="enter flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
