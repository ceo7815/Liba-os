import type { Profile } from "@/lib/types";
import {
  type PermissionKey,
  normalizePermissionKeys,
} from "@/lib/permissions/catalog";

export type AccessProfile = {
  email?: string | null;
  full_name?: string | null;
  role?: Profile["role"] | null;
  permissionKeys?: Profile["permissionKeys"] | null;
};

function permissionSet(profile: AccessProfile | null | undefined): Set<string> {
  return new Set(normalizePermissionKeys(profile?.permissionKeys));
}

/** True when the user was explicitly granted this capability. */
export function hasPermission(
  profile: AccessProfile | null | undefined,
  key: PermissionKey,
): boolean {
  if (!profile) return false;
  return permissionSet(profile).has(key);
}

export function hasAnyPermission(
  profile: AccessProfile | null | undefined,
  keys: readonly PermissionKey[],
): boolean {
  if (!profile || keys.length === 0) return false;
  const set = permissionSet(profile);
  return keys.some((k) => set.has(k));
}

/** Any finance subsection. */
export function canAccessAnyFinance(profile: AccessProfile | null | undefined): boolean {
  return hasAnyPermission(profile, [
    "finance.pl_general",
    "finance.source_pnl",
    "finance.fixed_expenses",
    "finance.insurance",
    "finance.settled",
    "finance.ledger",
  ]);
}

export function canAccessSales(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "sales.view");
}

export function canManageUsers(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "org.users");
}

export function canViewEmployees(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "employees.view");
}

export function canViewEmployeeAgreements(
  profile: AccessProfile | null | undefined,
): boolean {
  return hasPermission(profile, "employees.agreements");
}

export function canViewAgents(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "agents.view");
}

export function canManageAgents(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "agents.manage");
}

const SHEMESH_ENTRY = ["shemesh.view", "shemesh.manage", "shemesh.ops", "shemesh.handler", "shemesh.marketing", "shemesh.finance", "shemesh.sysadmin"] as const;
const SHEMESH_ALL_CASES = ["shemesh.view", "shemesh.manage", "shemesh.ops", "shemesh.sysadmin"] as const;

export function canViewShemesh(profile: AccessProfile | null | undefined): boolean {
  return profile?.role === "admin" || hasAnyPermission(profile, SHEMESH_ENTRY);
}

export function canManageShemesh(profile: AccessProfile | null | undefined): boolean {
  return profile?.role === "admin" || hasAnyPermission(profile, ["shemesh.manage", "shemesh.sysadmin"]);
}

export function canEditShemeshCases(profile: AccessProfile | null | undefined): boolean {
  return profile?.role === "admin" || hasAnyPermission(profile, ["shemesh.manage", "shemesh.ops", "shemesh.handler"]);
}

export function seesAllShemeshCases(profile: AccessProfile | null | undefined): boolean {
  return profile?.role === "admin" || hasAnyPermission(profile, SHEMESH_ALL_CASES);
}

export function handlerOnlyName(profile: AccessProfile | null | undefined): string | null {
  if (!profile || !hasPermission(profile, "shemesh.handler") || seesAllShemeshCases(profile)) return null;
  return profile.full_name || profile.email || null;
}

export function canViewShemeshPayroll(profile: AccessProfile | null | undefined): boolean {
  return profile?.role === "admin" || hasAnyPermission(profile, ["shemesh.manage", "shemesh.finance"]);
}

export function canViewVault(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "vault.view");
}

export function canManageVault(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "vault.manage");
}

export function canLearnAcademy(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "academy.learn");
}

export function canViewAcademyTeam(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "academy.team");
}

export function canManageAcademy(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "academy.manage");
}

export function canAccessAcademy(profile: AccessProfile | null | undefined): boolean {
  return canLearnAcademy(profile) || canViewAcademyTeam(profile) || canManageAcademy(profile);
}
