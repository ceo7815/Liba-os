import type { Profile } from "@/lib/types";
import { canAccessSales } from "@/lib/permissions/access";

export const SALES_DASHBOARD_PATH = "/sales-dashboard";
export const SALES_BY_SOURCE_PATH = "/sales-dashboard/by-source";
export const SALES_EXCEL_REPORT_PATH = "/sales-dashboard/excel";

/** In-app preview of the sales TV dashboard. */
export function canAccessSalesDashboard(
  profile: Pick<Profile, "role" | "permissionKeys"> | null | undefined,
): boolean {
  if (canAccessSales(profile)) return true;
  // Bridge until every admin has sales.view seeded
  return profile?.role === "admin";
}
