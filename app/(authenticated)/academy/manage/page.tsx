import type { Metadata } from "next";
import { listAcademyManageLessons } from "@/app/actions/academy";
import { AcademyManageScreen } from "@/components/academy/manage-screen";
import { requireAcademyManage } from "@/lib/auth";

export const metadata: Metadata = { title: "ניהול הדרכה" };
export const dynamic = "force-dynamic";

export default async function AcademyManagePage() {
  await requireAcademyManage();
  const result = await listAcademyManageLessons();
  if (!result.ok) return <p className="text-sm text-red-600">{result.error}</p>;
  return <AcademyManageScreen lessons={result.lessons} />;
}
