import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamRunner } from "@/components/academy/exam-runner";
import { requireAcademyLearn } from "@/lib/auth";
import { fetchCourseById, fetchExamById } from "@/lib/academy/catalog";

export const metadata: Metadata = { title: "מבחן" };
export const dynamic = "force-dynamic";

export default async function AcademyExamPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAcademyLearn();
  const exam = await fetchExamById(params.id);
  if (!exam) notFound();
  const course = await fetchCourseById(exam.courseId);
  if (!course) notFound();
  return <ExamRunner examId={exam.id} courseId={course.id} />;
}
