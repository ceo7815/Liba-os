import {
  canLearnAcademy,
  canManageAcademy,
  canViewAcademyTeam,
  type AccessProfile,
} from "@/lib/permissions/access";

export const ACADEMY_PATH = "/academy";
export const ACADEMY_CATALOG_PATH = "/academy/catalog";
export const ACADEMY_TEAM_PATH = "/academy/team";
export const ACADEMY_MANAGE_PATH = "/academy/manage";

export { canLearnAcademy, canManageAcademy, canViewAcademyTeam };

export function canAccessAcademy(profile: AccessProfile | null | undefined): boolean {
  return (
    canLearnAcademy(profile) ||
    canViewAcademyTeam(profile) ||
    canManageAcademy(profile)
  );
}
