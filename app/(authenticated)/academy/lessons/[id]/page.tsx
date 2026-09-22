import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAcademyLesson } from "@/app/actions/academy";
import { LessonPlayer } from "@/components/academy/lesson-player";
import { requireAcademyLearn } from "@/lib/auth";

export const metadata: Metadata = { title: "שיעור" };
export const dynamic = "force-dynamic";

export default async function AcademyLessonPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAcademyLearn();
  const result = await getAcademyLesson(params.id);
  if (!result.ok) {
    if (result.error === "השיעור לא נמצא") notFound();
    return <p className="text-sm text-red-600">{result.error}</p>;
  }
  return <LessonPlayer data={result.data} />;
}
