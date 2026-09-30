import {
  canAccessSales,
  canManageUsers,
  canViewAgents,
  type AccessProfile,
} from "@/lib/permissions/access";

export const INTERFACES_PATH = "/interfaces";

export function canViewInterfaces(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.role === "admin" ||
    canAccessSales(profile) ||
    canViewAgents(profile) ||
    canManageUsers(profile)
  );
}
