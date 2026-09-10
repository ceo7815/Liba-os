import type { Profile } from "@/lib/types";
import { canAccessSales } from "@/lib/permissions/access";

/** In-app preview of the sales TV dashboard. */
export function canAccessSalesDashboard(
  profile: Pick<Profile, "role" | "permissionKeys"> | null | undefined,
): boolean {
  if (canAccessSales(profile)) return true;
  // Bridge until every admin has sales.view seeded
  return profile?.role === "admin";
}
