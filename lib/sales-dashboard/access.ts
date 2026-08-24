import type { Profile } from "@/lib/types";

/** In-app preview of the sales TV dashboard. Admins only; the office TV uses a kiosk token. */
export function canAccessSalesDashboard(
  profile: Pick<Profile, "role"> | null | undefined,
): boolean {
  return profile?.role === "admin";
}
