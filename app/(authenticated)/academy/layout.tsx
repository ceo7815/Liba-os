import { AcademySectionNav, type AcademyTab } from "@/components/academy/academy-section-nav";
import { requireProfile } from "@/lib/auth";
import {
  ACADEMY_CATALOG_PATH,
  ACADEMY_MANAGE_PATH,
  ACADEMY_PATH,
  ACADEMY_TEAM_PATH,
  canLearnAcademy,
  canManageAcademy,
  canViewAcademyTeam,
} from "@/lib/academy/access";

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const tabs: AcademyTab[] = [];
  if (canLearnAcademy(profile)) {
    tabs.push({ id: "home", href: ACADEMY_PATH, label: "שלי" });
    tabs.push({ id: "catalog", href: ACADEMY_CATALOG_PATH, label: "קורסים" });
  }
  if (canViewAcademyTeam(profile)) {
    tabs.push({ id: "team", href: ACADEMY_TEAM_PATH, label: "צוות" });
  }
  if (canManageAcademy(profile)) {
    tabs.push({ id: "manage", href: ACADEMY_MANAGE_PATH, label: "תוכן" });
  }

  return (
    <div>
      <AcademySectionNav tabs={tabs} />
      {children}
    </div>
  );
}
