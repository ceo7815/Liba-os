import type { Profile } from "@/lib/types";
import {
  type PermissionKey,
  normalizePermissionKeys,
} from "@/lib/permissions/catalog";

export type AccessProfile = {
  email?: string | null;
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

export function canViewVault(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "vault.view");
}

export function canManageVault(profile: AccessProfile | null | undefined): boolean {
  return hasPermission(profile, "vault.manage");
}
