import {
  canAccessAnyFinance,
  canManageUsers,
  canViewEmployeeAgreements,
  canViewEmployees,
  type AccessProfile,
} from "@/lib/permissions/access";

export const FORMULAS_PATH = "/organization/formulas";

export function canViewFormulas(profile: AccessProfile | null | undefined): boolean {
  return (
    canManageUsers(profile) ||
    canViewEmployees(profile) ||
    canViewEmployeeAgreements(profile) ||
    canAccessAnyFinance(profile)
  );
}
