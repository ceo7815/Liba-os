"use client";

import { usePathname } from "next/navigation";

export type OsModule =
  | "dashboard"
  | "leads"
  | "sales"
  | "campaigns"
  | "marketing"
  | "finance"
  | "people"
  | "academy"
  | "system";

export function moduleFromPath(pathname: string): OsModule {
  if (pathname.startsWith("/lead-control")) return "leads";
  if (pathname.startsWith("/sales-dashboard/campaigns")) return "campaigns";
  if (pathname.startsWith("/marketing")) return "marketing";
  if (pathname.startsWith("/sales-dashboard")) return "sales";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/employees")) return "people";
  if (pathname.startsWith("/academy")) return "academy";
  if (pathname === "/design-lab" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return pathname.startsWith("/dashboard/users") ? "system" : "dashboard";
  }
  return "system";
}

export function ShellFrame({
  children,
  module,
}: {
  children: React.ReactNode;
  module?: OsModule;
}) {
  const pathname = usePathname();

  return (
    <div
      data-module={module ?? moduleFromPath(pathname)}
      className="os-mesh flex min-h-dvh bg-background text-foreground"
    >
      {children}
    </div>
  );
}
